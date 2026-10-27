import 'package:flutter/material.dart';
import 'screens/history_screen.dart';
import 'screens/market_config_screen.dart';
import 'screens/shopping_list_screen.dart';
import 'services/shopping_controller.dart';
import 'package:cloud_firestore/cloud_firestore.dart';


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
  int _currentTabIndex = 0;

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

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0D9488);

    return MaterialApp(
      title: 'Carrinho de Compras',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor,
          brightness: Brightness.light,
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF1E293B),
          elevation: 0,
          scrolledUnderElevation: 0.5,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFF1E293B),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: const Color(0xFFF8FAFC),
          selectedColor: const Color(0xFFCCFBF1),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
          labelStyle: const TextStyle(
            fontSize: 12,
            color: Color(0xFF334155),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFCCFBF1),
          elevation: 1,
          height: 62,
          labelTextStyle: WidgetStateProperty.all(
            const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF334155),
            ),
          ),
        ),
      ),
      home: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) {
          final screens = [
            ShoppingListScreen(controller: _controller),
            HistoryScreen(controller: _controller),
            MarketConfigScreen(controller: _controller),
          ];

          return Scaffold(
            body: IndexedStack(
              index: _currentTabIndex,
              children: screens,
            ),
            bottomNavigationBar: Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
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
                  NavigationDestination(
                    icon: Badge(
                      isLabelVisible: _controller.pendingItemsCount > 0,
                      backgroundColor: primaryColor,
                      label: Text('${_controller.pendingItemsCount}'),
                      child: const Icon(Icons.checklist_rounded),
                    ),
                    selectedIcon: Badge(
                      isLabelVisible: _controller.pendingItemsCount > 0,
                      backgroundColor: primaryColor,
                      label: Text('${_controller.pendingItemsCount}'),
                      child: const Icon(Icons.checklist_rtl_rounded),
                    ),
                    label: 'Lista',
                  ),
                  NavigationDestination(
                    icon: Badge(
                      isLabelVisible: _controller.history.isNotEmpty,
                      backgroundColor: const Color(0xFF64748B),
                      label: Text('${_controller.history.length}'),
                      child: const Icon(Icons.analytics_outlined),
                    ),
                    selectedIcon: const Icon(Icons.analytics_rounded),
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
          );
        },
      ),
    );
  }
}
