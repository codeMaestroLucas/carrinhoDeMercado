import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

class LottieCartSplashWidget extends StatefulWidget {
  const LottieCartSplashWidget({
    super.key,
    this.size = 220,
    this.strokeColorOverride,
  });

  final double size;
  final Color? strokeColorOverride;

  @override
  State<LottieCartSplashWidget> createState() => _LottieCartSplashWidgetState();
}

class _LottieCartSplashWidgetState extends State<LottieCartSplashWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Map<String, dynamic>? _lottieData;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _loadLottieJson();
  }

  Future<void> _loadLottieJson() async {
    try {
      final raw = await rootBundle.loadString(
        'assets/lotties/shopping_cart.json',
      );
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _lottieData = decoded;
        });
      }
    } catch (_) {
      // Fallback gracefully if asset cannot be loaded in test environment
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_lottieData == null) {
      return SizedBox(
        width: widget.size,
        height: widget.size,
        child: const Center(
          child: Icon(
            Icons.shopping_cart_outlined,
            size: 64,
            color: AppColors.primaryGreen,
          ),
        ),
      );
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        // Loop frames 0..47 smoothly
        final frame = _controller.value * 47.0;
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: CustomPaint(
            painter: _LottieCompositionPainter(
              lottie: _lottieData!,
              frame: frame,
              strokeColorOverride: widget.strokeColorOverride,
            ),
          ),
        );
      },
    );
  }
}

class _LottieCompositionPainter extends CustomPainter {
  _LottieCompositionPainter({
    required this.lottie,
    required this.frame,
    this.strokeColorOverride,
  });

  final Map<String, dynamic> lottie;
  final double frame;
  final Color? strokeColorOverride;

  Map<String, List<dynamic>> get _assetsById {
    final map = <String, List<dynamic>>{};
    final assets = lottie['assets'] as List<dynamic>? ?? const [];
    for (final a in assets) {
      if (a is Map<String, dynamic>) {
        final id = a['id'] as String?;
        final layers = a['layers'] as List<dynamic>?;
        if (id != null && layers != null) {
          map[id] = layers;
        }
      }
    }
    return map;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final assetsMap = _assetsById;
    final mainLayers = lottie['layers'] as List<dynamic>? ?? const [];

    // The shopping cart & groceries occupy roughly x: [80..295], y: [370..570]
    // Center is roughly (187.5, 475) with span ~220x220
    canvas.save();
    final scale = size.width / 230.0;
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(scale, scale);
    canvas.translate(-187.5, -475.0);

    _paintLayers(canvas, mainLayers, frame, assetsMap);

    canvas.restore();
  }

  void _paintLayers(
    Canvas canvas,
    List<dynamic> layers,
    double localFrame,
    Map<String, List<dynamic>> assetsMap,
  ) {
    // In Lottie, layers are painted from bottom of the list to top (reverse order)
    for (var i = layers.length - 1; i >= 0; i--) {
      final layer = layers[i];
      if (layer is! Map<String, dynamic>) continue;
      if (layer['hd'] == true) continue;

      final ip = (layer['ip'] as num?)?.toDouble() ?? 0.0;
      final op = (layer['op'] as num?)?.toDouble() ?? 9999.0;
      if (localFrame < ip || localFrame > op) continue;

      final ks = layer['ks'] as Map<String, dynamic>? ?? const {};
      final opacity = _evalScalar(ks['o'], localFrame, 100.0) / 100.0;
      if (opacity <= 0.01) continue;

      final pos = _evalVec(ks['p'], localFrame, const [0.0, 0.0]);
      final anchor = _evalVec(ks['a'], localFrame, const [0.0, 0.0]);
      final scale = _evalVec(ks['s'], localFrame, const [100.0, 100.0]);
      final rot = _evalScalar(ks['r'], localFrame, 0.0);

      canvas.save();
      canvas.translate(pos[0], pos[1]);
      if (rot != 0) {
        canvas.rotate(rot * math.pi / 180.0);
      }
      canvas.scale(scale[0] / 100.0, scale[1] / 100.0);
      canvas.translate(-anchor[0], -anchor[1]);

      final ty = layer['ty'] as int? ?? -1;
      if (ty == 0) {
        // Precomp layer
        final refId = layer['refId'] as String?;
        final st = (layer['st'] as num?)?.toDouble() ?? 0.0;
        final childLayers = refId != null ? assetsMap[refId] : null;
        if (childLayers != null) {
          _paintLayers(canvas, childLayers, localFrame - st, assetsMap);
        }
      } else if (ty == 4) {
        // Shape layer
        final shapes = layer['shapes'] as List<dynamic>? ?? const [];
        _paintShapes(canvas, shapes, localFrame, opacity);
      }

      canvas.restore();
    }
  }

  void _paintShapes(
    Canvas canvas,
    List<dynamic> shapes,
    double localFrame,
    double layerOpacity,
  ) {
    // Check if there is a layer-level Trim Paths ('tm') inside shapes
    Map<String, dynamic>? layerTrim;
    for (final s in shapes) {
      if (s is Map<String, dynamic> && s['ty'] == 'tm') {
        layerTrim = s;
        break;
      }
    }

    for (var i = shapes.length - 1; i >= 0; i--) {
      final s = shapes[i];
      if (s is! Map<String, dynamic>) continue;
      if (s['hd'] == true) continue;

      if (s['ty'] == 'gr') {
        _paintShapeGroup(
          canvas,
          s['it'] as List<dynamic>? ?? const [],
          localFrame,
          layerOpacity,
          inheritedTrim: layerTrim,
        );
      }
    }
  }

  void _paintShapeGroup(
    Canvas canvas,
    List<dynamic> items,
    double localFrame,
    double layerOpacity, {
    Map<String, dynamic>? inheritedTrim,
  }) {
    Map<String, dynamic>? transformItem;
    Map<String, dynamic>? fillItem;
    Map<String, dynamic>? strokeItem;
    Map<String, dynamic>? trimItem = inheritedTrim;
    final paths = <Path>[];

    for (final raw in items) {
      if (raw is! Map<String, dynamic>) continue;
      if (raw['hd'] == true) continue;
      final ty = raw['ty'] as String?;
      if (ty == 'tr') {
        transformItem = raw;
      } else if (ty == 'fl') {
        fillItem = raw;
      } else if (ty == 'st') {
        strokeItem = raw;
      } else if (ty == 'tm') {
        trimItem = raw;
      } else if (ty == 'sh') {
        final p = _buildBezierPath(raw['ks'], localFrame);
        if (p != null) paths.add(p);
      } else if (ty == 'el') {
        final elSize = _evalVec(raw['s'], localFrame, const [0.0, 0.0]);
        final elPos = _evalVec(raw['p'], localFrame, const [0.0, 0.0]);
        final rect = Rect.fromCenter(
          center: Offset(elPos[0], elPos[1]),
          width: elSize[0],
          height: elSize[1],
        );
        paths.add(Path()..addOval(rect));
      } else if (ty == 'sr') {
        final p = _buildPolystarPath(raw, localFrame);
        if (p != null) paths.add(p);
      }
    }

    if (paths.isEmpty) return;

    canvas.save();
    double groupOpacity = layerOpacity;
    if (transformItem != null) {
      final pos = _evalVec(transformItem['p'], localFrame, const [0.0, 0.0]);
      final anchor = _evalVec(transformItem['a'], localFrame, const [0.0, 0.0]);
      final scale =
          _evalVec(transformItem['s'], localFrame, const [100.0, 100.0]);
      final rot = _evalScalar(transformItem['r'], localFrame, 0.0);
      final op = _evalScalar(transformItem['o'], localFrame, 100.0) / 100.0;
      groupOpacity *= op;

      canvas.translate(pos[0], pos[1]);
      if (rot != 0) {
        canvas.rotate(rot * math.pi / 180.0);
      }
      canvas.scale(scale[0] / 100.0, scale[1] / 100.0);
      canvas.translate(-anchor[0], -anchor[1]);
    }

    var combinedPath = Path();
    for (final p in paths) {
      combinedPath.addPath(p, Offset.zero);
    }

    if (trimItem != null) {
      final startPct =
          (_evalScalar(trimItem['s'], localFrame, 0.0) / 100.0).clamp(0.0, 1.0);
      final endPct = (_evalScalar(trimItem['e'], localFrame, 100.0) / 100.0)
          .clamp(0.0, 1.0);
      combinedPath = _trimPath(combinedPath, startPct, endPct);
    }

    if (fillItem != null) {
      final colorVec =
          _evalVec(fillItem['c'], localFrame, const [0.0, 0.0, 0.0, 1.0]);
      final fillOp = _evalScalar(fillItem['o'], localFrame, 100.0) / 100.0;
      final color = Color.fromRGBO(
        (colorVec[0] * 255).round().clamp(0, 255),
        (colorVec[1] * 255).round().clamp(0, 255),
        (colorVec[2] * 255).round().clamp(0, 255),
        (groupOpacity * fillOp).clamp(0.0, 1.0),
      );
      final paint = Paint()
        ..style = PaintingStyle.fill
        ..color = color
        ..isAntiAlias = true;
      canvas.drawPath(combinedPath, paint);
    }

    if (strokeItem != null) {
      final colorVec =
          _evalVec(strokeItem['c'], localFrame, const [0.0, 0.0, 0.0, 1.0]);
      final strokeOp = _evalScalar(strokeItem['o'], localFrame, 100.0) / 100.0;
      final width = _evalScalar(strokeItem['w'], localFrame, 2.0);
      Color color = Color.fromRGBO(
        (colorVec[0] * 255).round().clamp(0, 255),
        (colorVec[1] * 255).round().clamp(0, 255),
        (colorVec[2] * 255).round().clamp(0, 255),
        (groupOpacity * strokeOp).clamp(0.0, 1.0),
      );
      if (strokeColorOverride != null &&
          colorVec[0] < 0.35 &&
          colorVec[1] < 0.35 &&
          colorVec[2] < 0.35) {
        color = strokeColorOverride!.withValues(
          alpha: (groupOpacity * strokeOp).clamp(0.0, 1.0),
        );
      }

      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = color
        ..isAntiAlias = true;
      canvas.drawPath(combinedPath, paint);
    }

    canvas.restore();
  }

  Path _trimPath(Path source, double startFraction, double endFraction) {
    final s = math.min(startFraction, endFraction);
    final e = math.max(startFraction, endFraction);
    if ((e - s) <= 0.001) return Path();
    if (s <= 0.001 && e >= 0.999) return source;

    final result = Path();
    for (final metric in source.computeMetrics()) {
      final len = metric.length;
      result.addPath(
        metric.extractPath(len * s, len * e),
        Offset.zero,
      );
    }
    return result;
  }

  Path? _buildBezierPath(dynamic ksRaw, double localFrame) {
    if (ksRaw is! Map<String, dynamic>) return null;
    final k = ksRaw['k'];
    Map<String, dynamic>? shapeMap;
    if (k is Map<String, dynamic>) {
      shapeMap = k;
    } else if (k is List && k.isNotEmpty && k.first is Map<String, dynamic>) {
      final firstS = (k.first as Map<String, dynamic>)['s'];
      if (firstS is List &&
          firstS.isNotEmpty &&
          firstS.first is Map<String, dynamic>) {
        shapeMap = firstS.first as Map<String, dynamic>;
      }
    }
    if (shapeMap == null) return null;

    final v = shapeMap['v'] as List<dynamic>? ?? const [];
    final inTangents = shapeMap['i'] as List<dynamic>? ?? const [];
    final outTangents = shapeMap['o'] as List<dynamic>? ?? const [];
    final closed = shapeMap['c'] as bool? ?? false;

    if (v.isEmpty) return null;

    final path = Path();
    final p0 = _toPair(v[0]);
    path.moveTo(p0[0], p0[1]);

    for (var i = 1; i < v.length; i++) {
      final prevV = _toPair(v[i - 1]);
      final prevO = i - 1 < outTangents.length
          ? _toPair(outTangents[i - 1])
          : const [0.0, 0.0];
      final currV = _toPair(v[i]);
      final currI =
          i < inTangents.length ? _toPair(inTangents[i]) : const [0.0, 0.0];

      path.cubicTo(
        prevV[0] + prevO[0],
        prevV[1] + prevO[1],
        currV[0] + currI[0],
        currV[1] + currI[1],
        currV[0],
        currV[1],
      );
    }

    if (closed && v.length > 1) {
      final lastIdx = v.length - 1;
      final prevV = _toPair(v[lastIdx]);
      final prevO = lastIdx < outTangents.length
          ? _toPair(outTangents[lastIdx])
          : const [0.0, 0.0];
      final currV = _toPair(v[0]);
      final currI =
          inTangents.isNotEmpty ? _toPair(inTangents[0]) : const [0.0, 0.0];

      path.cubicTo(
        prevV[0] + prevO[0],
        prevV[1] + prevO[1],
        currV[0] + currI[0],
        currV[1] + currI[1],
        currV[0],
        currV[1],
      );
      path.close();
    }

    return path;
  }

  Path? _buildPolystarPath(Map<String, dynamic> sr, double localFrame) {
    final pts = _evalScalar(sr['pt'], localFrame, 3.0).round();
    if (pts < 3) return null;
    final center = _evalVec(sr['p'], localFrame, const [0.0, 0.0]);
    final radius = _evalScalar(sr['or'], localFrame, 2.0);
    final rotDeg = _evalScalar(sr['r'], localFrame, 0.0);

    final path = Path();
    for (var i = 0; i < pts; i++) {
      final angle = (rotDeg - 90.0 + (360.0 * i / pts)) * math.pi / 180.0;
      final x = center[0] + radius * math.cos(angle);
      final y = center[1] + radius * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    return path;
  }

  List<double> _toPair(dynamic raw) {
    if (raw is List && raw.length >= 2) {
      return [
        (raw[0] as num).toDouble(),
        (raw[1] as num).toDouble(),
      ];
    }
    return const [0.0, 0.0];
  }

  double _evalScalar(dynamic prop, double frame, double fallback) {
    if (prop is! Map<String, dynamic>) return fallback;
    final a = prop['a'] as int? ?? 0;
    final k = prop['k'];
    if (a == 0) {
      if (k is num) return k.toDouble();
      if (k is List && k.isNotEmpty && k.first is num) {
        return (k.first as num).toDouble();
      }
      return fallback;
    }
    if (k is List) {
      return _interpolateKeyframesScalar(k, frame, fallback);
    }
    return fallback;
  }

  List<double> _evalVec(dynamic prop, double frame, List<double> fallback) {
    if (prop is! Map<String, dynamic>) return fallback;
    final a = prop['a'] as int? ?? 0;
    final k = prop['k'];
    if (a == 0) {
      if (k is List) {
        return k.whereType<num>().map((e) => e.toDouble()).toList();
      }
      return fallback;
    }
    if (k is List) {
      return _interpolateKeyframesVec(k, frame, fallback);
    }
    return fallback;
  }

  double _interpolateKeyframesScalar(
    List<dynamic> keyframes,
    double frame,
    double fallback,
  ) {
    if (keyframes.isEmpty) return fallback;
    Map<String, dynamic>? prevKf;
    Map<String, dynamic>? nextKf;

    for (var i = 0; i < keyframes.length; i++) {
      final kf = keyframes[i];
      if (kf is! Map<String, dynamic>) continue;
      final t = (kf['t'] as num?)?.toDouble() ?? 0.0;
      if (frame < t) {
        nextKf = kf;
        break;
      }
      prevKf = kf;
    }

    if (prevKf == null) {
      final first = keyframes.first as Map<String, dynamic>;
      final s = first['s'];
      if (s is List && s.isNotEmpty && s.first is num) {
        return (s.first as num).toDouble();
      }
      return fallback;
    }

    final startList = prevKf['s'] as List<dynamic>?;
    final startVal =
        (startList != null && startList.isNotEmpty && startList.first is num)
            ? (startList.first as num).toDouble()
            : fallback;

    if (nextKf == null) return startVal;

    final endList =
        (nextKf['s'] as List<dynamic>?) ?? (prevKf['e'] as List<dynamic>?);
    final endVal =
        (endList != null && endList.isNotEmpty && endList.first is num)
            ? (endList.first as num).toDouble()
            : startVal;

    final t0 = (prevKf['t'] as num?)?.toDouble() ?? 0.0;
    final t1 = (nextKf['t'] as num?)?.toDouble() ?? t0;
    if (t1 <= t0) return endVal;

    final rawRatio = ((frame - t0) / (t1 - t0)).clamp(0.0, 1.0);
    final eased = Curves.easeInOut.transform(rawRatio);
    return startVal + (endVal - startVal) * eased;
  }

  List<double> _interpolateKeyframesVec(
    List<dynamic> keyframes,
    double frame,
    List<double> fallback,
  ) {
    if (keyframes.isEmpty) return fallback;
    Map<String, dynamic>? prevKf;
    Map<String, dynamic>? nextKf;

    for (var i = 0; i < keyframes.length; i++) {
      final kf = keyframes[i];
      if (kf is! Map<String, dynamic>) continue;
      final t = (kf['t'] as num?)?.toDouble() ?? 0.0;
      if (frame < t) {
        nextKf = kf;
        break;
      }
      prevKf = kf;
    }

    if (prevKf == null) {
      final first = keyframes.first as Map<String, dynamic>;
      final s = first['s'] as List<dynamic>?;
      if (s != null) {
        return s.whereType<num>().map((e) => e.toDouble()).toList();
      }
      return fallback;
    }

    final startList = prevKf['s'] as List<dynamic>?;
    final startVec = startList != null
        ? startList.whereType<num>().map((e) => e.toDouble()).toList()
        : fallback;

    if (nextKf == null) return startVec;

    final endList =
        (nextKf['s'] as List<dynamic>?) ?? (prevKf['e'] as List<dynamic>?);
    final endVec = endList != null
        ? endList.whereType<num>().map((e) => e.toDouble()).toList()
        : startVec;

    final t0 = (prevKf['t'] as num?)?.toDouble() ?? 0.0;
    final t1 = (nextKf['t'] as num?)?.toDouble() ?? t0;
    if (t1 <= t0) return endVec;

    final rawRatio = ((frame - t0) / (t1 - t0)).clamp(0.0, 1.0);
    final eased = Curves.easeInOut.transform(rawRatio);

    final len = math.min(startVec.length, endVec.length);
    return List<double>.generate(
      len,
      (idx) => startVec[idx] + (endVec[idx] - startVec[idx]) * eased,
    );
  }

  @override
  bool shouldRepaint(covariant _LottieCompositionPainter oldDelegate) {
    return oldDelegate.frame != frame ||
        oldDelegate.strokeColorOverride != strokeColorOverride ||
        oldDelegate.lottie != lottie;
  }
}
