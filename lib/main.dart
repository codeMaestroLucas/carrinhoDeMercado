import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:home_widget/home_widget.dart';
import 'screens/home_screen.dart';
import 'screens/history_screen.dart';
import 'screens/market_config_screen.dart';
import 'screens/shopping_list_screen.dart';
import 'services/shopping_controller.dart';
import 'services/home_widget_service.dart';
import 'services/category_classifier.dart';
import 'theme/app_colors.dart';
import 'widgets/lottie_cart_splash.dart';

// Conecta automaticamente ao seu banco '(default)'
final db = FirebaseFirestore.instance;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CarrinhoComprasApp(showSplashOnStart: true));
}

class CarrinhoComprasApp extends StatefulWidget {
  const CarrinhoComprasApp({
    super.key,
    this.controller,
    this.showSplashOnStart = false,
  });

  final ShoppingController? controller;
  final bool showSplashOnStart;

  @override
  State<CarrinhoComprasApp> createState() => _CarrinhoComprasAppState();
}

class _CarrinhoComprasAppState extends State<CarrinhoComprasApp>
    with WidgetsBindingObserver {
  late final ShoppingController _controller;
  int _currentTabIndex = 1; // Opens on Lista (index 1), with Home (casinha) at index 0
  late bool _isShowingSplash;
  Timer? _splashTimer;
  StreamSubscription<Uri?>? _widgetClickSubscription;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = widget.controller ?? ShoppingController();
    _isShowingSplash = widget.showSplashOnStart;
    if (_isShowingSplash) {
      _splashTimer = Timer(const Duration(milliseconds: 2500), () {
        if (mounted) {
          setState(() {
            _isShowingSplash = false;
          });
        }
      });
    }

    HomeWidgetService.initialize();
    HomeWidget.initiallyLaunchedFromHomeWidget().then(_handleWidgetUri);
    _widgetClickSubscription = HomeWidget.widgetClicked.listen(_handleWidgetUri);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _controller.initializeCloudSync();
      _controller.syncFromHomeWidget();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _controller.syncFromHomeWidget();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _widgetClickSubscription?.cancel();
    _splashTimer?.cancel();
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  void _handleWidgetUri(Uri? uri) {
    if (uri == null) return;
    if (uri.scheme == 'carrinho') {
      if (mounted) {
        setState(() {
          _isShowingSplash = false;
          _currentTabIndex = 1;
        });
      }
      if (uri.host == 'add_item') {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showQuickAddFromWidget();
        });
      }
    }
  }

  void _showQuickAddFromWidget() {
    final ctx = _navigatorKey.currentContext;
    if (ctx == null) return;

    final textController = TextEditingController();

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        final isDark = Theme.of(modalCtx).brightness == Brightness.dark;

        void handleProcessAndSave(String input) {
          final clean = input.trim();
          if (clean.isEmpty) return;

          final detected = CategoryClassifier.parsePastedList(clean);
          if (detected.length > 1 || clean.contains('\n') || clean.contains(';')) {
            _controller.addItemsFromPastedTextWithReport(clean);
          } else {
            _controller.addSingleItem(clean);
          }
          Navigator.of(modalCtx).pop();
        }

        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(modalCtx).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface(modalCtx),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Adicionar ao Carrinho',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary(modalCtx),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(modalCtx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: textController,
                  autofocus: true,
                  style: TextStyle(color: AppColors.textPrimary(modalCtx)),
                  decoration: InputDecoration(
                    hintText: 'Ex: Leite, 2kg de maçã, 3 cx sabão...',
                    hintStyle: TextStyle(color: AppColors.textSecondary(modalCtx)),
                    filled: true,
                    fillColor: isDark
                        ? const Color(0xFF23272F)
                        : const Color(0xFFF8F9FA),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onSubmitted: handleProcessAndSave,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () => handleProcessAndSave(textController.text),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryGreen,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Adicionar Item',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  ThemeData _buildTheme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkBackground : AppColors.lightBackground;
    final surface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrimary =
        isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSecondary =
        isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
    final borderColor =
        isDark ? const Color(0xFF2E3440) : const Color(0xFFE5E7EB);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primaryGreen,
        primary: AppColors.primaryGreen,
        secondary: AppColors.accentGreen,
        brightness: brightness,
        surface: surface,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? const Color(0xFF181B20) : surface,
        selectedColor: AppColors.primaryGreen.withValues(
          alpha: isDark ? 0.24 : 0.16,
        ),
        side: BorderSide(color: borderColor),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textPrimary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: AppColors.primaryGreen.withValues(
          alpha: isDark ? 0.22 : 0.15,
        ),
        elevation: 0,
        height: 64,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(
              color: AppColors.primaryGreen,
              size: 23,
            );
          }
          return IconThemeData(
            color: textSecondary,
            size: 22,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final isSelected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? AppColors.primaryGreen : textSecondary,
          );
        }),
      ),
    );
  }

  Widget _buildSplashScreen(BuildContext context, bool isDark) {
    final bg = isDark ? AppColors.darkBackground : AppColors.lightBackground;
    final textPrimary =
        isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSecondary =
        isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: bg,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          setState(() {
            _isShowingSplash = false;
          });
        },
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  LottieCartSplashWidget(
                    size: 230,
                    strokeColorOverride: isDark ? Colors.white : null,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Carrinho de Compras',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Suas listas inteligentes e economia por mercado',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13.5,
                      color: textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: 110,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: LinearProgressIndicator(
                        minHeight: 4,
                        backgroundColor: AppColors.primaryGreen.withValues(
                          alpha: 0.16,
                        ),
                        color: AppColors.primaryGreen,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        final isDark = _controller.isDarkMode;
        final screens = [
          HomeScreen(controller: _controller),
          ShoppingListScreen(controller: _controller),
          HistoryScreen(controller: _controller),
          MarketConfigScreen(controller: _controller),
        ];

        return MaterialApp(
          navigatorKey: _navigatorKey,
          title: 'Carrinho de Compras',
          debugShowCheckedModeBanner: false,
          themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
          theme: _buildTheme(Brightness.light),
          darkTheme: _buildTheme(Brightness.dark),
          home: AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            child: _isShowingSplash
                ? _buildSplashScreen(context, isDark)
                : Scaffold(
                    key: const ValueKey('main_scaffold'),
                    body: IndexedStack(
                      index: _currentTabIndex,
                      children: screens,
                    ),
                    bottomNavigationBar: Container(
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(
                            color: isDark
                                ? const Color(0xFF282D37)
                                : const Color(0xFFE5E7EB),
                            width: 1,
                          ),
                        ),
                      ),
                      child: NavigationBar(
                        selectedIndex: _currentTabIndex,
                        onDestinationSelected: (index) {
                          setState(() {
                            _currentTabIndex = index;
                          });
                        },
                        destinations: [
                          const NavigationDestination(
                            icon: Icon(Icons.home_outlined),
                            selectedIcon: Icon(Icons.home_rounded),
                            label: 'Início',
                          ),
                          NavigationDestination(
                            icon: Badge(
                              isLabelVisible: _controller.pendingItemsCount > 0,
                              backgroundColor: AppColors.primaryGreen,
                              textColor: Colors.white,
                              label: Text('${_controller.pendingItemsCount}'),
                              child:
                                  const Icon(Icons.format_list_bulleted_rounded),
                            ),
                            selectedIcon: Badge(
                              isLabelVisible: _controller.pendingItemsCount > 0,
                              backgroundColor: AppColors.primaryGreen,
                              textColor: Colors.white,
                              label: Text('${_controller.pendingItemsCount}'),
                              child:
                                  const Icon(Icons.format_list_bulleted_rounded),
                            ),
                            label: 'Lista',
                          ),
                          const NavigationDestination(
                            icon: Icon(Icons.receipt_long_outlined),
                            selectedIcon: Icon(Icons.receipt_long_rounded),
                            label: 'Histórico',
                          ),
                          const NavigationDestination(
                            icon: Icon(Icons.tune_rounded),
                            selectedIcon: Icon(Icons.tune_rounded),
                            label: 'Configurações',
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        );
      },
    );
  }
}
