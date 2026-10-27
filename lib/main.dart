import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'screens/home_screen.dart';
import 'screens/history_screen.dart';
import 'screens/market_config_screen.dart';
import 'screens/shopping_list_screen.dart';
import 'services/shopping_controller.dart';
import 'theme/app_colors.dart';

// Conecta automaticamente ao seu banco '(default)'
final db = FirebaseFirestore.instance;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CarrinhoComprasApp());
}

class CarrinhoComprasApp extends StatefulWidget {
  const CarrinhoComprasApp({
    super.key,
    this.controller,
  });

  final ShoppingController? controller;

  @override
  State<CarrinhoComprasApp> createState() => _CarrinhoComprasAppState();
}

class _CarrinhoComprasAppState extends State<CarrinhoComprasApp> {
  late final ShoppingController _controller;
  int _currentTabIndex = 1; // Opens on Lista (index 1), with Home (casinha) at index 0

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? ShoppingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _controller.initializeCloudSync();
    });
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
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
          title: 'Carrinho de Compras',
          debugShowCheckedModeBanner: false,
          themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
          theme: _buildTheme(Brightness.light),
          darkTheme: _buildTheme(Brightness.dark),
          home: Scaffold(
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
                      child: const Icon(Icons.format_list_bulleted_rounded),
                    ),
                    selectedIcon: Badge(
                      isLabelVisible: _controller.pendingItemsCount > 0,
                      backgroundColor: AppColors.primaryGreen,
                      textColor: Colors.white,
                      label: Text('${_controller.pendingItemsCount}'),
                      child: const Icon(Icons.format_list_bulleted_rounded),
                    ),
                    label: 'Lista',
                  ),
                  NavigationDestination(
                    icon: Badge(
                      isLabelVisible: _controller.history.isNotEmpty,
                      backgroundColor: AppColors.accentGreen,
                      textColor: Colors.white,
                      label: Text('${_controller.history.length}'),
                      child: const Icon(Icons.receipt_long_outlined),
                    ),
                    selectedIcon: const Icon(Icons.receipt_long_rounded),
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
        );
      },
    );
  }
}
