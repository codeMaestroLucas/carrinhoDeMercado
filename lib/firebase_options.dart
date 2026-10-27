// File generated for Firebase project: carrinho-de-compras-35ded
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return ios;
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCIYnU_4dW56K3xjJ_2DAw0UpMn2h8sJvE',
    appId: '1:123154169081:android:95e53dde8fa1dcfc47f628',
    messagingSenderId: '123154169081',
    projectId: 'carrinho-de-compras-35ded',
    storageBucket: 'carrinho-de-compras-35ded.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBkNMK7NdA3aQFxy9A2LsrgqJr0tggnzig',
    appId: '1:123154169081:ios:6536457a37d6993547f628',
    messagingSenderId: '123154169081',
    projectId: 'carrinho-de-compras-35ded',
    storageBucket: 'carrinho-de-compras-35ded.firebasestorage.app',
    iosBundleId: 'com.example.carrinhocompras',
  );
}
