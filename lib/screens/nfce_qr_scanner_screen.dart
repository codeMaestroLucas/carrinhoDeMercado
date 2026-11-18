import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import '../services/nfce_scanner_service.dart';
import '../services/receipt_scanner_service.dart';
import '../theme/app_colors.dart';

enum NfceScanMode {
  qrCode,
  linkSefaz,
}

class NfceQrScannerScreen extends StatefulWidget {
  const NfceQrScannerScreen({
    super.key,
    this.initialMode = NfceScanMode.qrCode,
  });

  final NfceScanMode initialMode;

  @override
  State<NfceQrScannerScreen> createState() => _NfceQrScannerScreenState();
}

class _NfceQrScannerScreenState extends State<NfceQrScannerScreen>
    with SingleTickerProviderStateMixin {
  CameraController? _cameraController;
  List<CameraDescription> _availableCameras = [];
  int _selectedCameraIndex = 0;
  bool _isCameraInitialized = false;

  late final BarcodeScanner _barcodeScanner;
  late final TextRecognizer _textRecognizer;
  late final AnimationController _animController;
  late final Animation<double> _scanAnimation;

  late NfceScanMode _scanMode;
  bool _isScanningActive = false;
  bool _isProcessing = false;
  bool _isTorchOn = false;
  Timer? _scanTimer;

  @override
  void initState() {
    super.initState();
    _scanMode = widget.initialMode;

    _barcodeScanner = BarcodeScanner(formats: [BarcodeFormat.all]);
    _textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _scanAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _availableCameras = await availableCameras();
      if (_availableCameras.isEmpty) {
        if (mounted) setState(() => _isCameraInitialized = false);
        return;
      }

      // Default to back camera
      _selectedCameraIndex = _availableCameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
      );
      if (_selectedCameraIndex < 0) _selectedCameraIndex = 0;

      await _setupCameraController(_availableCameras[_selectedCameraIndex]);
    } catch (e) {
      debugPrint('Error finding cameras: $e');
      if (mounted) setState(() => _isCameraInitialized = false);
    }
  }

  Future<void> _setupCameraController(CameraDescription description) async {
    final prev = _cameraController;
    if (prev != null) {
      await prev.dispose();
    }

    final controller = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _cameraController = controller;
        _isCameraInitialized = true;
        _isTorchOn = false;
      });
    } catch (e) {
      debugPrint('Camera init error: $e');
      if (mounted) setState(() => _isCameraInitialized = false);
    }
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    _animController.dispose();
    _cameraController?.dispose();
    _barcodeScanner.close();
    _textRecognizer.close();
    super.dispose();
  }

  void _toggleScanning() {
    setState(() {
      _isScanningActive = !_isScanningActive;
    });

    if (_isScanningActive) {
      _startPeriodicScan();
    } else {
      _scanTimer?.cancel();
    }
  }

  void _startPeriodicScan() {
    _scanTimer?.cancel();
    _scanTimer = Timer.periodic(const Duration(milliseconds: 950), (_) {
      if (_isScanningActive && !_isProcessing && mounted) {
        _scanCurrentFrame(silent: true);
      }
    });
  }

  Future<void> _scanCurrentFrame({bool silent = false}) async {
    final controller = _cameraController;
    if (controller == null || !controller.value.isInitialized || _isProcessing) {
      return;
    }

    setState(() => _isProcessing = true);

    XFile? capturedFile;
    try {
      capturedFile = await controller.takePicture();
      final inputImage = InputImage.fromFilePath(capturedFile.path);

      if (_scanMode == NfceScanMode.qrCode) {
        final barcodes = await _barcodeScanner.processImage(inputImage);
        for (final b in barcodes) {
          final raw = b.rawValue;
          if (raw != null && raw.trim().isNotEmpty) {
            _scanTimer?.cancel();
            _isScanningActive = false;
            HapticFeedback.mediumImpact();
            await _cleanupFile(capturedFile);
            if (mounted) Navigator.of(context).pop(raw.trim());
            return;
          }
        }
      } else {
        final recognizedText = await _textRecognizer.processImage(inputImage);
        final rawOcr = recognizedText.text;

        final url = NfceScannerService.extractSefazUrl(rawOcr);
        if (url != null && url.isNotEmpty) {
          _scanTimer?.cancel();
          _isScanningActive = false;
          HapticFeedback.mediumImpact();
          await _cleanupFile(capturedFile);
          if (mounted) {
            final confirmed = await _showConfirmLinkDialog(url);
            if (confirmed != null && confirmed.isNotEmpty && mounted) {
              Navigator.of(context).pop(confirmed);
              return;
            }
          }
          return;
        }
      }

      await _cleanupFile(capturedFile);

      if (!silent && mounted) {
        final msg = _scanMode == NfceScanMode.linkSefaz
            ? 'Não identificamos o Link da SEFAZ. Aproxime a câmera do endereço web impresso na nota fiscal.'
            : 'Nenhum QR Code identificado. Aproxime do código.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error scanning frame: $e');
      await _cleanupFile(capturedFile);
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  Future<void> _cleanupFile(XFile? file) async {
    if (file == null) return;
    try {
      final f = File(file.path);
      if (await f.exists()) {
        await f.delete();
      }
    } catch (_) {}
  }

  /// Dialog shown to inspect, edit and confirm the SEFAZ Link URL.
  Future<String?> _showConfirmLinkDialog(String initialLink) async {
    final textController = TextEditingController(text: initialLink);

    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final text = textController.text.trim();
            final isValid = text.startsWith('http://') ||
                text.startsWith('https://') ||
                text.contains('.gov.br') ||
                text.contains('sefaz') ||
                text.contains('fazenda');

            return AlertDialog(
              backgroundColor: AppColors.surface(context),
              title: const Row(
                children: [
                  Icon(Icons.link_rounded, color: AppColors.primaryGreen),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Revisar Link da SEFAZ',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Confira o link da SEFAZ identificado na nota fiscal. Você pode editá-lo caso algum caractere esteja incorreto:',
                      style: TextStyle(fontSize: 12.5),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: textController,
                      keyboardType: TextInputType.url,
                      maxLines: 3,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                      ),
                      decoration: InputDecoration(
                        filled: true,
                        labelText: 'Endereço da SEFAZ',
                        hintText: 'https://www.sefaz.../nfce/consulta...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      onChanged: (val) {
                        setDialogState(() {});
                      },
                    ),
                    const SizedBox(height: 8),
                    if (isValid)
                      const Row(
                        children: [
                          Icon(Icons.check_circle_rounded,
                              color: AppColors.accentGreen, size: 15),
                          SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Link válido para consulta SEFAZ',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: AppColors.accentGreen,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Atenção: O link deve começar com http:// ou https:// e conter o endereço da SEFAZ.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.orange.shade800,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(null),
                  child: const Text('Escanear Novamente'),
                ),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: isValid && text.isNotEmpty
                      ? () {
                          var finalUrl = text;
                          if (!finalUrl.startsWith('http://') &&
                              !finalUrl.startsWith('https://')) {
                            finalUrl = 'https://$finalUrl';
                          }
                          Navigator.of(dialogCtx).pop(finalUrl);
                        }
                      : null,
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: const Text('Confirmar e Consultar'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _pickFromGallery() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 95,
      );
      if (picked == null) return;

      setState(() => _isProcessing = true);

      // 1. Try QR Code detection on the picked image first
      final inputImage = InputImage.fromFilePath(picked.path);
      final barcodes = await _barcodeScanner.processImage(inputImage);
      if (barcodes.isNotEmpty) {
        for (final b in barcodes) {
          final raw = b.rawValue;
          if (raw != null && raw.trim().isNotEmpty && mounted) {
            setState(() => _isProcessing = false);
            HapticFeedback.mediumImpact();
            Navigator.of(context).pop(raw.trim());
            return;
          }
        }
      }

      // 2. Try OCR text recognition for SEFAZ Link
      final ocrText =
          await ReceiptScannerService.recognizeTextFromImage(picked.path);

      final extractedUrl = NfceScannerService.extractSefazUrl(ocrText);
      if (mounted) setState(() => _isProcessing = false);

      if (extractedUrl != null && extractedUrl.isNotEmpty && mounted) {
        final confirmedUrl = await _showConfirmLinkDialog(extractedUrl);
        if (confirmedUrl != null && confirmedUrl.isNotEmpty && mounted) {
          HapticFeedback.mediumImpact();
          Navigator.of(context).pop(confirmedUrl);
          return;
        }
        return;
      }

      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _scanMode == NfceScanMode.linkSefaz
                  ? 'Nenhum link da SEFAZ identificado nesta imagem da galeria.'
                  : 'Nenhum QR Code ou Link da SEFAZ identificado nesta imagem.',
            ),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao analisar imagem da galeria: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _showManualInputDialog() async {
    final textController = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          backgroundColor: AppColors.surface(context),
          title: const Row(
            children: [
              Icon(Icons.edit_note_rounded, color: AppColors.primaryGreen),
              SizedBox(width: 8),
              Expanded(child: Text('Digitar Chave / Link')),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Digite os 11 grupos de 4 números (44 dígitos) ou cole o link da nota:',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                autofocus: true,
                maxLines: 2,
                keyboardType: TextInputType.text,
                decoration: InputDecoration(
                  hintText: '5326 1104 9720 ... ou https://...',
                  filled: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                final text = textController.text.trim();
                if (text.isNotEmpty) {
                  Navigator.of(dialogCtx).pop(text);
                }
              },
              child: const Text('Confirmar'),
            ),
          ],
        );
      },
    );

    if (result != null && result.isNotEmpty && mounted) {
      final clean = result.replaceAll(RegExp(r'\D'), '');
      if (clean.length == 44) {
        Navigator.of(context).pop(clean);
      } else {
        Navigator.of(context).pop(result);
      }
    }
  }

  Future<void> _toggleTorch() async {
    final controller = _cameraController;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      final newTorch = !_isTorchOn;
      await controller.setFlashMode(newTorch ? FlashMode.torch : FlashMode.off);
      setState(() => _isTorchOn = newTorch);
    } catch (_) {}
  }

  Future<void> _switchCamera() async {
    if (_availableCameras.length < 2) return;
    _selectedCameraIndex =
        (_selectedCameraIndex + 1) % _availableCameras.length;
    await _setupCameraController(_availableCameras[_selectedCameraIndex]);
  }

  @override
  Widget build(BuildContext context) {
    final isLinkMode = _scanMode == NfceScanMode.linkSefaz;
    final isWide = isLinkMode;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Live Camera Preview
          if (_isCameraInitialized && _cameraController != null)
            GestureDetector(
              onTapUp: (details) async {
                final controller = _cameraController;
                if (controller != null && controller.value.isInitialized) {
                  final offset = details.localPosition;
                  final size = MediaQuery.of(context).size;
                  final point = Offset(
                    (offset.dx / size.width).clamp(0.0, 1.0),
                    (offset.dy / size.height).clamp(0.0, 1.0),
                  );
                  try {
                    await controller.setFocusPoint(point);
                    await controller.setExposurePoint(point);
                  } catch (_) {}
                }
              },
              child: Center(
                child: CameraPreview(_cameraController!),
              ),
            )
          else
            _buildCameraFallback(),

          // 2. Dimmed Cutout Overlay + Glowing Reticle
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final height = constraints.maxHeight;

              final boxWidth = isWide ? width * 0.88 : 260.0;
              final boxHeight = isWide ? 140.0 : 260.0;
              final left = (width - boxWidth) / 2;
              final top = (height - boxHeight) / 2 - 30;

              return Stack(
                children: [
                  ColorFiltered(
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.65),
                      BlendMode.srcOut,
                    ),
                    child: Stack(
                      children: [
                        Container(
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                            backgroundBlendMode: BlendMode.dstOut,
                          ),
                        ),
                        Positioned(
                          left: left,
                          top: top,
                          width: boxWidth,
                          height: boxHeight,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.red,
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  Positioned(
                    left: left,
                    top: top,
                    width: boxWidth,
                    height: boxHeight,
                    child: Stack(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: _isScanningActive
                                  ? AppColors.primaryGreen
                                  : AppColors.primaryGreen.withValues(alpha: 0.45),
                              width: _isScanningActive ? 2.0 : 1.5,
                            ),
                          ),
                        ),

                        _buildCorner(top: 0, left: 0, isTop: true, isLeft: true),
                        _buildCorner(top: 0, right: 0, isTop: true, isLeft: false),
                        _buildCorner(bottom: 0, left: 0, isTop: false, isLeft: true),
                        _buildCorner(bottom: 0, right: 0, isTop: false, isLeft: false),

                        if (_isScanningActive)
                          AnimatedBuilder(
                            animation: _scanAnimation,
                            builder: (context, child) {
                              return Positioned(
                                top: _scanAnimation.value * (boxHeight - 20) + 10,
                                left: 14,
                                right: 14,
                                child: Container(
                                  height: 2.5,
                                  decoration: const BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.transparent,
                                        AppColors.primaryGreen,
                                        Colors.transparent,
                                      ],
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primaryGreen,
                                        blurRadius: 8,
                                        spreadRadius: 1.5,
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),

          // 3. Top Action Bar & Mode Switcher
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildCircularButton(
                          icon: Icons.close_rounded,
                          onTap: () => Navigator.of(context).pop(),
                          tooltip: 'Fechar',
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2),
                            ),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.qr_code_scanner_rounded,
                                color: AppColors.primaryGreen,
                                size: 16,
                              ),
                              SizedBox(width: 6),
                              Text(
                                'Leitor NFC-e',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildCircularButton(
                              icon: _isTorchOn
                                  ? Icons.flash_on_rounded
                                  : Icons.flash_off_rounded,
                              iconColor: _isTorchOn ? Colors.amber : Colors.white,
                              onTap: _toggleTorch,
                              tooltip: 'Lanterna',
                            ),
                            const SizedBox(width: 8),
                            _buildCircularButton(
                              icon: Icons.cameraswitch_rounded,
                              onTap: _switchCamera,
                              tooltip: 'Inverter Câmera',
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Mode Switcher: QR Code vs Link SEFAZ
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildModeTab(
                              title: 'QR Code',
                              icon: Icons.qr_code_scanner_rounded,
                              isSelected: _scanMode == NfceScanMode.qrCode,
                              onTap: () {
                                if (_scanMode != NfceScanMode.qrCode) {
                                  setState(() {
                                    _scanMode = NfceScanMode.qrCode;
                                  });
                                }
                              },
                            ),
                            _buildModeTab(
                              title: 'Link SEFAZ',
                              icon: Icons.link_rounded,
                              isSelected: isLinkMode,
                              onTap: () {
                                if (!isLinkMode) {
                                  setState(() {
                                    _scanMode = NfceScanMode.linkSefaz;
                                  });
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4. Status Indicator Badge
          SafeArea(
            child: Align(
              alignment: Alignment.center,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 170, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _isScanningActive
                          ? AppColors.primaryGreen
                          : Colors.white24,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isScanningActive
                              ? AppColors.accentGreen
                              : Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _isScanningActive
                              ? 'Escaneando ao vivo... Aponte para a nota'
                              : 'Toque em "Escanear" ou "Ao Vivo"',
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 5. Processing overlay
          if (_isProcessing)
            Container(
              color: Colors.black.withValues(alpha: 0.4),
              child: const Center(
                child: CircularProgressIndicator(
                  color: AppColors.primaryGreen,
                ),
              ),
            ),

          // 6. Bottom Controls & Action buttons
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Main scan action buttons: "Escanear Agora" and "Começar/Pausar Leitura"
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryGreen,
                              foregroundColor: Colors.white,
                              elevation: 3,
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed: _isProcessing
                                ? null
                                : () => _scanCurrentFrame(silent: false),
                            icon: const Icon(Icons.document_scanner_rounded,
                                size: 20),
                            label: Text(
                              isLinkMode
                                  ? 'Escanear Link'
                                  : 'Escanear QR',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              backgroundColor: _isScanningActive
                                  ? Colors.red.withValues(alpha: 0.25)
                                  : Colors.white.withValues(alpha: 0.15),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              side: BorderSide(
                                color: _isScanningActive
                                    ? Colors.redAccent
                                    : Colors.white30,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed: _toggleScanning,
                            icon: Icon(
                              _isScanningActive
                                  ? Icons.pause_circle_outline_rounded
                                  : Icons.play_circle_outline_rounded,
                              size: 18,
                              color: _isScanningActive
                                  ? Colors.redAccent
                                  : Colors.white,
                            ),
                            label: Text(
                              _isScanningActive ? 'Pausar' : 'Ao Vivo',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Gallery and Manual input buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.18),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(
                                  color: Colors.white.withValues(alpha: 0.25),
                                ),
                              ),
                            ),
                            onPressed: _isProcessing ? null : _pickFromGallery,
                            icon: const Icon(Icons.photo_library_outlined,
                                size: 18),
                            label: const Text(
                              'Galeria',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.18),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(
                                  color: Colors.white.withValues(alpha: 0.25),
                                ),
                              ),
                            ),
                            onPressed:
                                _isProcessing ? null : _showManualInputDialog,
                            icon: const Icon(Icons.edit_note_rounded, size: 18),
                            label: Text(
                              isLinkMode ? 'Digitar Link' : 'Digitar Chave',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCameraFallback() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.camera_alt_outlined,
              size: 56,
              color: Colors.white70,
            ),
            const SizedBox(height: 16),
            const Text(
              'Câmera do App',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Aponte a câmera para a nota ou escolha uma foto da galeria.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeTab({
    required String title,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryGreen : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSelected ? Colors.white : Colors.white70,
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCircularButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
    Color iconColor = Colors.white,
  }) {
    return Material(
      color: Colors.black.withValues(alpha: 0.55),
      shape: const CircleBorder(
        side: BorderSide(color: Colors.white24, width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon, color: iconColor, size: 20),
          ),
        ),
      ),
    );
  }

  Widget _buildCorner({
    double? top,
    double? bottom,
    double? left,
    double? right,
    required bool isTop,
    required bool isLeft,
  }) {
    const size = 26.0;
    const thickness = 4.0;
    const radius = Radius.circular(16);

    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          border: Border(
            top: isTop
                ? const BorderSide(
                    color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            bottom: !isTop
                ? const BorderSide(
                    color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            left: isLeft
                ? const BorderSide(
                    color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            right: !isLeft
                ? const BorderSide(
                    color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft: isTop && isLeft ? radius : Radius.zero,
            topRight: isTop && !isLeft ? radius : Radius.zero,
            bottomLeft: !isTop && isLeft ? radius : Radius.zero,
            bottomRight: !isTop && !isLeft ? radius : Radius.zero,
          ),
        ),
      ),
    );
  }
}
