import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../theme/app_colors.dart';

class NfceQrScannerScreen extends StatefulWidget {
  const NfceQrScannerScreen({super.key});

  @override
  State<NfceQrScannerScreen> createState() => _NfceQrScannerScreenState();
}

class _NfceQrScannerScreenState extends State<NfceQrScannerScreen>
    with SingleTickerProviderStateMixin {
  late final MobileScannerController _controller;
  late final AnimationController _animController;
  late final Animation<double> _scanAnimation;

  bool _hasScanned = false;
  bool _isTorchOn = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [BarcodeFormat.qrCode],
    );

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _scanAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_hasScanned) return;

    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw != null && raw.trim().isNotEmpty) {
        _hasScanned = true;
        HapticFeedback.mediumImpact();
        _controller.stop();
        Navigator.of(context).pop(raw.trim());
        break;
      }
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 95,
      );
      if (picked == null) return;

      final capture = await _controller.analyzeImage(picked.path);
      if (capture != null && capture.barcodes.isNotEmpty) {
        for (final barcode in capture.barcodes) {
          final raw = barcode.rawValue;
          if (raw != null && raw.trim().isNotEmpty && mounted) {
            _hasScanned = true;
            HapticFeedback.mediumImpact();
            _controller.stop();
            Navigator.of(context).pop(raw.trim());
            return;
          }
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Nenhum QR Code encontrado nesta foto. Tente aproximar ou escolha outra imagem.',
            ),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
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
                'Cole a URL do QR Code da SEFAZ ou os 44 dígitos da Chave de Acesso impressa:',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                autofocus: true,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'https://... ou 44 dígitos',
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
      _hasScanned = true;
      _controller.stop();
      Navigator.of(context).pop(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    const scanBoxSize = 260.0;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Live Camera Preview
          MobileScanner(
            controller: _controller,
            onDetect: _handleDetect,
            fit: BoxFit.cover,
            errorBuilder: (context, error) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.no_photography_outlined,
                        size: 56,
                        color: Colors.white70,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Acesso à Câmera Necessário',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Para escanear o QR Code, conceda acesso à câmera ou selecione uma foto da galeria.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: _pickFromGallery,
                        icon: const Icon(Icons.photo_library_outlined, size: 18),
                        label: const Text('Escolher da Galeria'),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _showManualInputDialog,
                        child: const Text(
                          'Digitar chave manualmente',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          // 2. Dimmed Cutout Overlay + Glowing Reticle
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final height = constraints.maxHeight;
              final left = (width - scanBoxSize) / 2;
              final top = (height - scanBoxSize) / 2 - 20;

              return Stack(
                children: [
                  // Dimmed border cutout
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
                          width: scanBoxSize,
                          height: scanBoxSize,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.red,
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Rounded Scanning Box Border & Corner Accents
                  Positioned(
                    left: left,
                    top: top,
                    width: scanBoxSize,
                    height: scanBoxSize,
                    child: Stack(
                      children: [
                        // Border outline
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: AppColors.primaryGreen.withValues(alpha: 0.45),
                              width: 1.5,
                            ),
                          ),
                        ),

                        // Corner markers
                        _buildCorner(top: 0, left: 0, isTop: true, isLeft: true),
                        _buildCorner(top: 0, right: 0, isTop: true, isLeft: false),
                        _buildCorner(bottom: 0, left: 0, isTop: false, isLeft: true),
                        _buildCorner(bottom: 0, right: 0, isTop: false, isLeft: false),

                        // Animated scanning laser line
                        AnimatedBuilder(
                          animation: _scanAnimation,
                          builder: (context, child) {
                            return Positioned(
                              top: _scanAnimation.value * (scanBoxSize - 20) + 10,
                              left: 14,
                              right: 14,
                              child: Container(
                                height: 2.5,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.transparent,
                                      AppColors.primaryGreen,
                                      Colors.transparent,
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primaryGreen
                                          .withValues(alpha: 0.8),
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

          // 3. Top Action Bar
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
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
                          onTap: () async {
                            await _controller.toggleTorch();
                            setState(() => _isTorchOn = !_isTorchOn);
                          },
                          tooltip: 'Lanterna',
                        ),
                        const SizedBox(width: 8),
                        _buildCircularButton(
                          icon: Icons.cameraswitch_rounded,
                          onTap: () => _controller.switchCamera(),
                          tooltip: 'Inverter Câmera',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4. Bottom Controls & Gallery / Manual Input
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: const Text(
                        'Aponte para o QR Code impresso no cupom fiscal',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white.withValues(alpha: 0.18),
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
                            onPressed: _pickFromGallery,
                            icon: const Icon(Icons.photo_library_outlined, size: 18),
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
                              backgroundColor: AppColors.primaryGreen,
                              foregroundColor: Colors.white,
                              elevation: 2,
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            onPressed: _showManualInputDialog,
                            icon: const Icon(Icons.edit_note_rounded, size: 18),
                            label: const Text(
                              'Digitar Chave',
                              style: TextStyle(
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
                ? const BorderSide(color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            bottom: !isTop
                ? const BorderSide(color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            left: isLeft
                ? const BorderSide(color: AppColors.primaryGreen, width: thickness)
                : BorderSide.none,
            right: !isLeft
                ? const BorderSide(color: AppColors.primaryGreen, width: thickness)
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
