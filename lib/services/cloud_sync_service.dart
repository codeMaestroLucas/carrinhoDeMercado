import 'dart:async';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import '../firebase_options.dart';

class CloudSyncService {
  static bool _initialized = false;
  static String? _initError;

  static bool get isFirebaseReady => _initialized;
  static String? get initializationError => _initError;

  /// Initializes Firebase using DefaultFirebaseOptions (from google-services.json
  /// and GoogleService-Info.plist). Safe to call multiple times.
  static Future<bool> initializeFirebase() async {
    if (_initialized) return true;
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        ).timeout(const Duration(seconds: 8));
      }
      _initialized = true;
      _initError = null;
      return true;
    } catch (e) {
      try {
        if (Firebase.apps.isEmpty) {
          await Firebase.initializeApp().timeout(const Duration(seconds: 8));
        }
        _initialized = true;
        _initError = null;
        return true;
      } catch (fallbackError) {
        _initialized = false;
        _initError = fallbackError.toString();
        debugPrint(
          'Firebase ainda não configurado neste ambiente: $fallbackError',
        );
        return false;
      }
    }
  }

  /// Generates a human-friendly shared space code like "CASA-4829".
  static String generateSpaceCode() {
    final random = Random.secure();
    final digits = 1000 + random.nextInt(9000);
    const prefixes = ['CASA', 'LISTA', 'FAMILIA', 'MERCADO'];
    final prefix = prefixes[random.nextInt(prefixes.length)];
    return '$prefix-$digits';
  }

  static String normalizeSpaceCode(String raw) {
    return raw.trim().toUpperCase().replaceAll(' ', '');
  }

  static DocumentReference<Map<String, dynamic>> _spaceDoc(String spaceCode) {
    return FirebaseFirestore.instance
        .collection('shared_spaces')
        .doc(normalizeSpaceCode(spaceCode));
  }

  /// Resets Firestore network state in case it entered exponential backoff.
  static Future<void> _ensureNetworkActive() async {
    try {
      await FirebaseFirestore.instance.enableNetwork();
    } catch (_) {
      // Ignore if not supported on platform
    }
  }

  /// Checks if a shared space document exists on Firestore.
  static Future<Map<String, dynamic>?> fetchSharedSpace(
    String spaceCode,
  ) async {
    final ready = await initializeFirebase();
    if (!ready) {
      throw Exception(
        'Não foi possível inicializar o Firebase: ${_initError ?? "verifique a configuração"}',
      );
    }

    await _ensureNetworkActive();

    try {
      final snapshot = await _spaceDoc(spaceCode)
          .get()
          .timeout(const Duration(seconds: 12));
      if (!snapshot.exists) return null;
      return snapshot.data();
    } on FirebaseException catch (e) {
      if (e.code == 'unavailable') {
        // Reset Firestore backoff and retry once
        try {
          await FirebaseFirestore.instance.disableNetwork();
          await FirebaseFirestore.instance.enableNetwork();
          final retrySnapshot = await _spaceDoc(spaceCode)
              .get()
              .timeout(const Duration(seconds: 12));
          if (!retrySnapshot.exists) return null;
          return retrySnapshot.data();
        } on FirebaseException catch (retryError) {
          throw Exception(_formatFirestoreError(retryError));
        }
      }
      throw Exception(_formatFirestoreError(e));
    } on TimeoutException {
      throw Exception(
        'Tempo esgotado ao buscar o código na nuvem. Verifique sua conexão com a internet.',
      );
    }
  }

  /// Writes the full shopping state into the shared space document on Firestore.
  static Future<void> pushStateToSharedSpace({
    required String spaceCode,
    required Map<String, dynamic> stateMap,
    required String clientId,
    bool verifyServer = false,
  }) async {
    final ready = await initializeFirebase();
    if (!ready) {
      throw Exception(
        'Não foi possível inicializar o Firebase: ${_initError ?? "verifique a configuração"}',
      );
    }

    await _ensureNetworkActive();

    final payload = <String, dynamic>{
      ...stateMap,
      'spaceCode': normalizeSpaceCode(spaceCode),
      'updatedByClientId': clientId,
      'updatedAt': FieldValue.serverTimestamp(),
      'updatedAtIso': DateTime.now().toIso8601String(),
    };

    try {
      if (verifyServer) {
        // Reset any previous offline backoff state before creating a new space
        await FirebaseFirestore.instance.disableNetwork();
        await FirebaseFirestore.instance.enableNetwork();
      }
      await _spaceDoc(spaceCode)
          .set(payload, SetOptions(merge: true))
          .timeout(const Duration(seconds: 12));
    } on TimeoutException {
      // Even if server ACK takes longer than 12s, Firestore queues the write and syncs automatically when online
      if (verifyServer) {
        debugPrint(
          'Firestore write pendente de confirmação do servidor; sincronização continuará em segundo plano.',
        );
      }
    } on FirebaseException catch (e) {
      throw Exception(_formatFirestoreError(e));
    }
  }

  static String _formatFirestoreError(FirebaseException e) {
    final msg = e.message ?? '';
    if (msg.contains('firestore.googleapis.com') ||
        msg.contains('has not been used')) {
      return 'A API do Cloud Firestore ainda está desativada no projeto Firebase (carrinho-de-compras-35ded). Ative-a no link do console.';
    }
    if (e.code == 'permission-denied') {
      return 'Permissão negada no Firestore. Verifique se o banco foi criado e se as Regras (Rules) permitem leitura/escrita em shared_spaces.';
    }
    if (e.code == 'unavailable') {
      return 'Servidor do Firestore indisponível no momento. Verifique no console do Firebase se você clicou em "Criar banco de dados" em Firestore Database.';
    }
    return 'Erro no Firestore (${e.code}): ${e.message}';
  }

  /// Listens to real-time changes on the shared space document.
  static StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>
      listenToSharedSpace({
    required String spaceCode,
    required void Function(Map<String, dynamic> data) onData,
    void Function(Object error)? onError,
  }) {
    return _spaceDoc(spaceCode).snapshots().listen(
      (snapshot) {
        final data = snapshot.data();
        if (data != null) {
          onData(data);
        }
      },
      onError: onError,
    );
  }
}
