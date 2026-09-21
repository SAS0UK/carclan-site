// Extrait les textes juridiques de l'application vers du JSON, que le site
// reprend mot pour mot.
//
// Pourquoi passer par Dart plutôt que par une expression régulière : le
// fichier de l'application est du code, avec des chaînes concaténées et des
// interpolations (`$publisherName`, `$contactEmail`, `$minimumAge`). Le
// relire à la main, ou le deviner à la regex, c'est la garantie qu'une
// phrase finira par diverger entre l'app et le site. Ici, c'est le compilateur
// Dart qui assemble les chaînes, donc le site reçoit exactement ce que
// l'écran de l'application affiche.
//
// Lancement (depuis le dépôt du site) :
//   ~/DEV/FLUTTER/flutter/bin/dart run tools/sync-legal.dart > src/legal/app-documents.json
//
// À relancer chaque fois que les documents de l'application changent. Le
// build refuse de passer si la version du JSON ne correspond plus à celle
// du dépôt CarClan (voir tools/check-legal.mjs).

import 'dart:convert';

import '../../car_clan/lib/features/settings/domain/legal_documents.dart';

Map<String, dynamic> _doc(LegalDocument d) => {
  'title': d.title,
  'updatedOn': d.updatedOn,
  'intro': d.intro,
  'sections': [
    for (final s in d.sections)
      {
        'heading': s.heading,
        'paragraphs': s.paragraphs,
        'bullets': s.bullets,
      },
  ],
};

void main() {
  final out = {
    'updatedOn': LegalDocuments.updatedOn,
    'publisherName': LegalDocuments.publisherName,
    'publisherCity': LegalDocuments.publisherCity,
    'contactEmail': LegalDocuments.contactEmail,
    'minimumAge': LegalDocuments.minimumAge,
    'terms': _doc(LegalDocuments.terms),
    'privacy': _doc(LegalDocuments.privacy),
    'legalNotice': _doc(LegalDocuments.legalNotice),
  };
  print(const JsonEncoder.withIndent('  ').convert(out));
}
