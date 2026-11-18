import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import '../services/category_classifier.dart';
import '../services/nfce_scanner_service.dart';
import '../services/receipt_scanner_service.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';

/// Screen that loads an official SEFAZ NFC-e URL inside an In-App WebView.
/// Configured with platform-matching User-Agents (without '; wv') and
/// third-party cookie support required for Cloudflare Turnstile & reCAPTCHA.
/// When the invoice table loads, it extracts items and returns [NfceParsedResult].
class NfceWebViewScreen extends StatefulWidget {
  const NfceWebViewScreen({
    super.key,
    required this.url,
    this.accessKey,
  });

  final String url;
  final String? accessKey;

  @override
  State<NfceWebViewScreen> createState() => _NfceWebViewScreenState();
}

class _NfceWebViewScreenState extends State<NfceWebViewScreen> {
  late final WebViewController _controller;
  Timer? _autoExtractionTimer;
  bool _isLoading = true;
  double _loadingProgress = 0.0;
  bool _isExtracting = false;
  bool _hasExtracted = false;
  String? _statusMessage;
  String? _currentUrl;

  /// Returns a realistic mobile browser User-Agent matching the host platform.
  /// On Android, we omit '; wv' and 'Version/4.0' so Cloudflare Turnstile
  /// does not classify the environment as an automated bot or throw Error 600010.
  static String get _cleanPlatformUserAgent {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
    }
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  }

  /// Lightweight, multi-frame JavaScript extractor that inspects the live DOM
  /// and plain text (matching SEFAZ DF, DANFE Nacional, SP, MG, RS, PR, etc.).
  static const String _jsExtractorCode = r'''
(function() {
  var result = {
    marketName: '',
    total: 0.0,
    items: [],
    accessKey: '',
    debugPreview: ''
  };

  function cleanName(n) {
    if (!n) return '';
    return n.replace(/\s*\(c[óo]d(?:igo)?:\s*\d+\)/gi, ' ')
            .replace(/^\s*\(?código:[^\)]*\)?\s*/gi, '')
            .replace(/^\s*\d{1,4}\s+\d{4,14}\s+/, '')
            .replace(/^\s*\d{1,14}[\s\.\-]+/, '')
            .replace(/\s+/g, ' ')
            .trim();
  }

  function parseQty(rawStr, unit) {
    if (!rawStr) return 1.0;
    var s = rawStr.toString().trim().replace(/\s+/g, '');
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.indexOf(',') !== -1) {
      s = s.replace(',', '.');
    }
    var q = parseFloat(s);
    if (isNaN(q) || q <= 0) return 1.0;

    var normUnit = (unit || '').toLowerCase();
    if (normUnit !== 'g' && normUnit !== 'gr' && normUnit !== 'gramas') {
      if (q >= 10000 && q % 10000 === 0) {
        q = q / 10000;
      } else if (q >= 1000 && q % 1000 === 0) {
        q = q / 1000;
      }
    }
    return q;
  }

  function processDocument(doc) {
    if (!doc || !doc.body) return;

    // 1. Direct Bootstrap NFC-e / DANFE Accordion extractor (SEFAZ-DF & modern portals)
    var listItems = doc.querySelectorAll('#collapse1 .list-group-item, .card .list-group-item, li.list-group-item');
    listItems.forEach(function(li) {
      var liText = li.innerText || li.textContent || '';
      var lower = liText.toLowerCase();

      // Must be an item row (contains Qtde. or Vl. Unit.) and NOT summary rows
      if (lower.indexOf('qtde') === -1 && lower.indexOf('vl. unit') === -1) {
        return;
      }
      if (lower.indexOf('qtd. total') !== -1 ||
          lower.indexOf('valor a pagar') !== -1 ||
          lower.indexOf('forma de pagamento') !== -1 ||
          lower.indexOf('tributos') !== -1) {
        return;
      }

      // Extract product code if present: (Cód: 1019816)
      var productCode = '';
      var codeMatch = liText.match(/\(c[óo]d(?:igo)?:\s*(\d+)\)/i);
      if (codeMatch) {
        productCode = codeMatch[1];
      }

      // Name: <p class="h6"> or .col-9, ignoring <small>
      var rawName = '';
      var nameEl = li.querySelector('.col-9 p.h6, p.h6, .col-9');
      if (nameEl) {
        var clone = nameEl.cloneNode(true);
        var small = clone.querySelector('small');
        if (small) small.remove();
        rawName = clone.innerText || clone.textContent || '';
      }

      // Price: look for .col-3 or .col-4 price span, or last price in li
      var price = 0.0;
      var cols = li.querySelectorAll('.col-3, .col-4');
      for (var c = cols.length - 1; c >= 0; c--) {
        var cTxt = cols[c].innerText || cols[c].textContent || '';
        var pMatch = cTxt.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
        if (pMatch) {
          price = parseFloat(pMatch[1].replace(/\./g, '').replace(',', '.'));
          if (price > 0) break;
        }
      }

      if (!price || price <= 0) {
        var allPrices = liText.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
        if (allPrices && allPrices.length > 0) {
          price = parseFloat(allPrices[allPrices.length - 1].replace(/\./g, '').replace(',', '.'));
        }
      }

      // Explicit Unit Price (Vl. Unit.: XX,XX)
      var unitPrice = null;
      var uvMatch = liText.match(/vl\.?\s*unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
      if (uvMatch) {
        var parsedUv = parseFloat(uvMatch[1].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsedUv) && parsedUv > 0) {
          unitPrice = parsedUv;
        }
      }

      var cleanedName = cleanName(rawName);
      var unit = 'un';
      var uMatch = liText.match(/\bUN\s*:\s*([a-zA-Z]{1,4})\b/i) || liText.match(/\b(UN|KG|G|L|LT|ML|CX|DZ|PCT|PC)\b/i);
      if (uMatch) {
        unit = uMatch[1].toLowerCase();
      }

      var qty = 1.0;
      var qMatch = liText.match(/(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)/i);
      if (qMatch) {
        qty = parseQty(qMatch[1], unit);
      }

      if (cleanedName.length >= 2 && price > 0) {
        result.items.push({
          name: cleanedName,
          price: price,
          quantity: qty,
          unit: unit,
          unitPrice: unitPrice,
          productCode: productCode
        });
      }
    });

    // 2. Class-based fallback: .txtTit / .valor (SP / generic SAT)
    if (result.items.length === 0) {
      var titElements = doc.querySelectorAll('.txtTit, .fixo-prod-nome');
      titElements.forEach(function(el) {
        var row = el.closest('tr') || el.parentElement;
        var name = cleanName(el.innerText || el.textContent || '');
        var valEl = row ? row.querySelector('.valor, .fixo-prod-vl-total') : null;
        var qEl = row ? row.querySelector('.Rqtd, .fixo-prod-qtd, .qtd') : null;
        var uEl = row ? row.querySelector('.RUN, .fixo-prod-un, .unidade') : null;
        var uvEl = row ? row.querySelector('.RvlUnit, .fixo-prod-vl-unit') : null;
        var cEl = row ? row.querySelector('.RCod, .fixo-prod-cod') : null;

        var unit = 'un';
        if (uEl) {
          var ut = (uEl.innerText || uEl.textContent || '').replace(/[^a-zA-Z]/g, '');
          if (ut) unit = ut.toLowerCase();
        }

        var qty = 1.0;
        if (qEl) {
          var qm = (qEl.innerText || qEl.textContent || '').match(/(\d+(?:[,\.]\d+)?)/);
          if (qm) {
            qty = parseQty(qm[1], unit);
          }
        }

        var unitPrice = null;
        if (uvEl) {
          var uvm = (uvEl.innerText || uvEl.textContent || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
          if (uvm) {
            var pUv = parseFloat(uvm[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(pUv) && pUv > 0) unitPrice = pUv;
          }
        }

        var productCode = '';
        if (cEl) {
          var cm = (cEl.innerText || cEl.textContent || '').match(/(\d+)/);
          if (cm) productCode = cm[1];
        }

        if (valEl) {
          var p = parseFloat((valEl.innerText || valEl.textContent || '').replace(/[^\d,]/g, '').replace(',', '.'));
          if (name.length >= 2 && !isNaN(p) && p > 0) {
            result.items.push({
              name: name,
              price: p,
              quantity: qty,
              unit: unit,
              unitPrice: unitPrice,
              productCode: productCode
            });
          }
        }
      });
    }

    // 3. Multi-line plain text scanning fallback
    if (result.items.length === 0) {
      var text = doc.body.innerText || doc.body.textContent || '';
      var lines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var lowLine = line.toLowerCase();

        if (lowLine.indexOf('qtde') !== -1 || lowLine.indexOf('vl. unit') !== -1) {
          var p = 0.0;
          if (i + 1 < lines.length) {
            var nextPMatch = lines[i + 1].match(/^(\d{1,3}(?:\.\d{3})*,\d{2})$/);
            if (nextPMatch) {
              p = parseFloat(nextPMatch[1].replace(/\./g, '').replace(',', '.'));
            }
          }
          if (p <= 0) {
            var thisPMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
            if (thisPMatch && thisPMatch.length > 0) {
              p = parseFloat(thisPMatch[thisPMatch.length - 1].replace(/\./g, '').replace(',', '.'));
            }
          }

          var unitPrice = null;
          var uvMatch = line.match(/vl\.?\s*unit\.?:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
          if (uvMatch) {
            var pUv = parseFloat(uvMatch[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(pUv) && pUv > 0) unitPrice = pUv;
          }

          var unit = 'un';
          var um = line.match(/\bUN\s*:\s*([a-zA-Z]{1,4})\b/i);
          if (um) unit = um[1].toLowerCase();

          var qty = 1.0;
          var qm = line.match(/(?:qtde|qtd|quant|quantidade)\.?:?\s*(\d+(?:[,\.]\d+)?)/i);
          if (qm) {
            qty = parseQty(qm[1], unit);
          }

          var rawCandidate = '';
          if (i >= 2 && lines[i - 1].toLowerCase().indexOf('total') !== -1) {
            rawCandidate = lines[i - 2];
          } else if (i >= 1) {
            rawCandidate = lines[i - 1];
          }

          var productCode = '';
          var cMatch = rawCandidate.match(/\(c[óo]d(?:igo)?:\s*(\d+)\)/i);
          if (cMatch) productCode = cMatch[1];

          var candidateName = cleanName(rawCandidate);
          if (candidateName.length >= 2 && p > 0) {
            var cLow = candidateName.toLowerCase();
            if (!cLow.includes('documento') && !cLow.includes('consumidor') && !cLow.includes('cnpj')) {
              result.items.push({
                name: candidateName,
                price: p,
                quantity: qty,
                unit: unit,
                unitPrice: unitPrice,
                productCode: productCode
              });
            }
          }
        }
      }
    }

    // Market Name from #heading1, card-header or before CNPJ
    if (!result.marketName) {
      var headerCol = doc.querySelector('#heading1 .col[style*="font-weight: bold"], #heading1 .col, .card-header .col');
      if (headerCol) {
        var mText = (headerCol.innerText || headerCol.textContent || '').trim();
        var mLow = mText.toLowerCase();
        if (mText.length > 2 && !mLow.includes('consumidor') && !mLow.includes('chave')) {
          result.marketName = mText;
        }
      }
      if (!result.marketName) {
        var bodyTxt = doc.body.innerText || doc.body.textContent || '';
        var cnpjMatch = bodyTxt.match(/([^\n\r]{3,80})[\s\r\n]+CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
        if (cnpjMatch) {
          var m = cnpjMatch[1].trim();
          var mLow = m.toLowerCase();
          if (!mLow.includes('documento') && !mLow.includes('danfe') && !mLow.includes('consulta') && !mLow.includes('fiscal') && !mLow.includes('consumidor')) {
            result.marketName = m;
          }
        }
      }
    }

    // Total Amount: check .campo-xml or Valor a pagar
    if (!result.total || result.total === 0) {
      var pagEls = doc.querySelectorAll('.campo-xml, .list-group-item');
      pagEls.forEach(function(el) {
        var elText = el.innerText || el.textContent || '';
        if (elText.toLowerCase().indexOf('valor a pagar') !== -1) {
          var valEl = el.querySelector('.col-4, .col-3, strong, p.h6');
          var m = (valEl ? (valEl.innerText || valEl.textContent || '') : elText).match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
          if (m) {
            result.total = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
          }
        }
      });
      if (!result.total || result.total === 0) {
        var bTxt = doc.body.innerText || doc.body.textContent || '';
        var totMatch = bTxt.match(/(?:valor\s+a\s+pagar|valor\s+total|total\s+a\s+pagar|vPag)[^\d]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (totMatch) {
          result.total = parseFloat(totMatch[1].replace(/\./g, '').replace(',', '.'));
        }
      }
    }

    // Access key: 11 groups of 4 digits
    if (!result.accessKey) {
      var allText = doc.body.innerText || doc.body.textContent || '';
      var chaveMatch = allText.match(/\b\d{4}(?:[\s\.\-]+\d{4}){10}\b/);
      if (chaveMatch) {
        result.accessKey = chaveMatch[0].replace(/\D/g, '');
      }
    }
  }

  processDocument(document);

  var iframes = document.querySelectorAll('iframe');
  for (var j = 0; j < iframes.length; j++) {
    try {
      var idoc = iframes[j].contentDocument || iframes[j].contentWindow.document;
      processDocument(idoc);
    } catch(e) {}
  }

  return JSON.stringify(result);
})();
''';

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.url;
    _initWebViewController();

    // Auto-capture watcher: periodically inspects live DOM every 1000ms.
    // The moment the user solves the captcha and SEFAZ renders the invoice,
    // this immediately extracts the items without requiring any user click.
    _autoExtractionTimer = Timer.periodic(
      const Duration(milliseconds: 1000),
      (_) {
        if (!_hasExtracted && mounted) {
          _attemptExtraction(silent: true);
        }
      },
    );
  }

  @override
  void dispose() {
    _autoExtractionTimer?.cancel();
    super.dispose();
  }

  void _initWebViewController() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent(_cleanPlatformUserAgent)
      ..addJavaScriptChannel(
        'NfceExtractorChannel',
        onMessageReceived: (JavaScriptMessage message) {
          _attemptExtraction(silent: true);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) {
              setState(() {
                _loadingProgress = progress / 100.0;
              });
            }
          },
          onPageStarted: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _currentUrl = url;
              });
            }
          },
          onPageFinished: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _currentUrl = url;
              });

              // If currently on a Cloudflare challenge page, do NOT inject extraction scripts
              final isChallengePage = url.contains('challenges.cloudflare.com') ||
                  url.contains('challenge-platform');

              if (!isChallengePage) {
                _injectExtractionScript();
                _attemptExtraction(silent: true);
              }
            }
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('SEFAZ WebView Resource Notice: ${error.description}');
          },
        ),
      );

    _configurePlatformSettings();
    _controller.loadRequest(Uri.parse(widget.url));
  }

  Future<void> _configurePlatformSettings() async {
    if (_controller.platform is AndroidWebViewController) {
      final androidController = _controller.platform as AndroidWebViewController;
      try {
        await AndroidWebViewCookieManager(
          const PlatformWebViewCookieManagerCreationParams(),
        ).setAcceptThirdPartyCookies(androidController, true);

        await androidController.setMediaPlaybackRequiresUserGesture(false);
      } catch (e) {
        debugPrint('Android WebView settings notice: $e');
      }
    }
  }

  Future<void> _injectExtractionScript() async {
    const jsCode = '''
      (function() {
        if (window._nfceScriptInjected) return;
        window._nfceScriptInjected = true;

        function checkReceiptPresence() {
          var hasAccordion = document.querySelector('#collapse1, #accordion1, .visao-mobile-nfce, .list-group-item') != null;
          var hasTable = document.querySelector('.txtTit, .fixo-prod-nome, #tabResult tr, table.tabelaDetalhes tr') != null;
          var bodyText = document.body ? (document.body.innerText || '') : '';
          var hasDanfe = bodyText.indexOf('Vl. Total') !== -1 ||
                         bodyText.indexOf('Vl.Total') !== -1 ||
                         bodyText.indexOf('Qtde.') !== -1 ||
                         bodyText.indexOf('DOCUMENTO AUXILIAR') !== -1;

          if ((hasAccordion || hasTable || hasDanfe) && window.NfceExtractorChannel) {
            window.NfceExtractorChannel.postMessage('READY');
          }
        }

        checkReceiptPresence();

        var observer = new MutationObserver(function() {
          checkReceiptPresence();
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }

        setInterval(checkReceiptPresence, 800);
      })();
    ''';
    try {
      await _controller.runJavaScript(jsCode);
    } catch (_) {}
  }

  Future<void> _attemptExtraction({bool silent = false}) async {
    if (_hasExtracted || !mounted || _isExtracting) return;
    _isExtracting = true;

    try {
      // 1. Direct In-Browser JavaScript extraction
      final jsResult = await _controller.runJavaScriptReturningResult(_jsExtractorCode);

      if (jsResult is String && jsResult.isNotEmpty) {
        String decoded = jsResult;
        if (decoded.startsWith('"') && decoded.endsWith('"')) {
          try {
            decoded = jsonDecode(decoded) as String;
          } catch (_) {}
        }

        try {
          final Map<String, dynamic> data = jsonDecode(decoded) as Map<String, dynamic>;
          final rawItems = (data['items'] as List?) ?? [];

          if (rawItems.isNotEmpty) {
            final items = <ScannedReceiptItem>[];
            for (final it in rawItems) {
              if (it is Map) {
                final name = it['name']?.toString() ?? '';
                final price = (it['price'] as num?)?.toDouble() ?? 0.0;
                final unitPrice = (it['unitPrice'] as num?)?.toDouble();
                final productCode = it['productCode']?.toString().trim();
                final rawQty = (it['quantity'] as num?)?.toDouble() ?? 1.0;
                final unit = it['unit']?.toString() ?? 'un';
                final normalizedUnit = AppFormatters.normalizeUnit(unit);
                final quantity = AppFormatters.parseQuantity(
                      rawQty.toString(),
                      unit: normalizedUnit,
                    ) ??
                    (rawQty > 0 ? rawQty : 1.0);
                if (name.isNotEmpty && price > 0) {
                  final formattedName = _formatItemName(name);
                  items.add(
                    ScannedReceiptItem(
                      name: formattedName,
                      price: price,
                      quantity: quantity > 0 ? quantity : 1.0,
                      unit: normalizedUnit,
                      unitPrice: unitPrice,
                      productCode: (productCode != null && productCode.isNotEmpty)
                          ? productCode
                          : null,
                      category: CategoryClassifier.classify(formattedName),
                    ),
                  );
                }
              }
            }

            if (items.isNotEmpty) {
              final mergedItems = NfceScannerService.mergeDuplicateItems(items);
              final rawMarket = data['marketName']?.toString().trim();
              final marketName = (rawMarket != null && rawMarket.isNotEmpty)
                  ? _formatItemName(rawMarket)
                  : null;
              final totalAmount = (data['total'] as num?)?.toDouble();

              final keyFromJs = data['accessKey']?.toString().trim();
              final effectiveKey = (keyFromJs != null && keyFromJs.isNotEmpty)
                  ? keyFromJs
                  : widget.accessKey;

              final parsed = NfceParsedResult(
                items: mergedItems,
                marketName: marketName,
                totalAmount: totalAmount,
                accessKey: effectiveKey,
                cnpj: effectiveKey != null
                    ? NfceScannerService.getCnpjFromAccessKey(effectiveKey)
                    : null,
                stateUf: effectiveKey != null
                    ? NfceScannerService.getUfFromAccessKey(effectiveKey)
                    : null,
              );

              _completeSuccess(parsed);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Secondary fallback: HTML outerHTML parsing via NfceScannerService
      final htmlResult = await _controller.runJavaScriptReturningResult(
        'document.documentElement.outerHTML',
      );

      String html = '';
      if (htmlResult is String) {
        html = htmlResult;
        if (html.startsWith('"') && html.endsWith('"')) {
          try {
            html = jsonDecode(html) as String;
          } catch (_) {}
        }
      }

      if (html.isNotEmpty) {
        final parsed = NfceScannerService.parseNfceHtml(
          html,
          fallbackKey: widget.accessKey,
        );
        if (parsed.isSuccess) {
          _completeSuccess(parsed);
          return;
        }
      }

      if (!silent && mounted) {
        _showHelpSnackbar(
          'Ainda aguardando a nota fiscal. Se a página estiver visível, tente rolar até os itens e clique em "Concluir" novamente.',
        );
      }
    } catch (e) {
      if (!silent && mounted) {
        _showHelpSnackbar('Não foi possível ler a página no momento.');
      }
    } finally {
      if (mounted) {
        _isExtracting = false;
      }
    }
  }

  void _completeSuccess(NfceParsedResult parsed) {
    if (_hasExtracted) return;
    _hasExtracted = true;
    _autoExtractionTimer?.cancel();
    HapticFeedback.heavyImpact();

    if (mounted) {
      setState(() {
        _statusMessage = '${parsed.items.length} itens identificados com sucesso!';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Nota Fiscal validada! Importando ${parsed.items.length} produtos...',
          ),
          backgroundColor: AppColors.primaryGreen,
          duration: const Duration(milliseconds: 1500),
        ),
      );

      Future.delayed(const Duration(milliseconds: 350), () {
        if (mounted) {
          Navigator.of(context).pop(parsed);
        }
      });
    }
  }

  static String _formatItemName(String raw) {
    return NfceScannerService.cleanNfceProductName(raw);
  }

  void _showHelpSnackbar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFFD97706),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textSecondary = AppColors.textSecondary(context);
    final surfaceColor = AppColors.surface(context);

    return Scaffold(
      backgroundColor: surfaceColor,
      appBar: AppBar(
        title: const Text(
          'Validação SEFAZ / NFC-e',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'Recarregar página',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              _controller.reload();
            },
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilledButton.tonalIcon(
              style: FilledButton.styleFrom(
                visualDensity: VisualDensity.compact,
                backgroundColor: AppColors.primaryGreen.withValues(alpha: 0.15),
                foregroundColor: AppColors.accentGreen,
              ),
              onPressed: () => _attemptExtraction(silent: false),
              icon: const Icon(Icons.download_done_rounded, size: 16),
              label: const Text('Extrair', style: TextStyle(fontSize: 12)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Informative banner explaining Captcha resolution
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: const Color(0xFFEFF6FF),
            child: Row(
              children: [
                const Icon(
                  Icons.shield_outlined,
                  color: Color(0xFF2563EB),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _statusMessage ??
                        'Se o portal exibir verificação ("Não sou um robô"), clique nela abaixo. Se a nota já estiver visível, toque em "Concluir / Extrair".',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: _statusMessage != null
                          ? AppColors.primaryGreen
                          : const Color(0xFF1E40AF),
                      fontWeight: _statusMessage != null
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
                if (_isLoading) ...[
                  const SizedBox(width: 8),
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                ],
              ],
            ),
          ),

          if (_loadingProgress < 1.0)
            LinearProgressIndicator(
              value: _loadingProgress,
              backgroundColor: Colors.transparent,
              color: AppColors.primaryGreen,
              minHeight: 2.5,
            ),

          // In-App WebView
          Expanded(
            child: WebViewWidget(controller: _controller),
          ),

          // Bottom Bar with guidance and manual trigger
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: surfaceColor,
              border: Border(
                top: BorderSide(
                  color: textSecondary.withValues(alpha: 0.15),
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _currentUrl?.contains('cloudflare') == true
                        ? 'Verificação de segurança em andamento...'
                        : 'Página oficial da SEFAZ.',
                    style: TextStyle(fontSize: 11, color: textSecondary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancelar'),
                ),
                const SizedBox(width: 4),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: () => _attemptExtraction(silent: false),
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Concluir'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
