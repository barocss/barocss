import { classifyAxisBoxSolidBooleanPoints, validateAxisBoxSolidBooleanPointClassification, validateAxisBoxSolidBoolean, compileCadModel } from '@barocss/cad';

export const CASE_KEYS = Object.freeze(['union', 'cavity', 'through', 'sever', 'empty']);
export const PINS = Object.freeze([
  {
    "file": "union.actual-panel_0.source0.css",
    "bytes": 677,
    "sha256": "e3ad2089a1a7e1cb2f88b7d06be6dfb96759ef62fee0bb5256050edc57adc6aa"
  },
  {
    "file": "union.actual-panel_1.source0.css",
    "bytes": 677,
    "sha256": "bf4995c925256466d316f2a40d7ad7e075e093f86c9915c15a05e47098b8d89c"
  },
  {
    "file": "union.actual-panel_2.source0.css",
    "bytes": 677,
    "sha256": "1a26af8ac90eb352a5e29cc2656c18b611a30725228cbe741e2305af6fa2d4a4"
  },
  {
    "file": "union.actual-panel_3.source0.css",
    "bytes": 677,
    "sha256": "2d527121300ac371802a4834717c4ef3d1f76d7338b4aa076c9f19feb8a8ac24"
  },
  {
    "file": "union.actual-panel_4.source0.css",
    "bytes": 677,
    "sha256": "e1fcfd99a57aaa190174e22475316d2943396b81050e3dacf3fd585fbf1af52d"
  },
  {
    "file": "union.actual-panel_5.source0.css",
    "bytes": 677,
    "sha256": "625a2420bec8a289dbc9c47f04fd8206ef04eff39403e0b751703a933a10411e"
  },
  {
    "file": "union.actual-panel_6.source0.css",
    "bytes": 677,
    "sha256": "e9db0b4b4a70b225f069fd8df93b0a670c2b79c5ab1f70b8c10252c236796e6e"
  },
  {
    "file": "union.actual-panel_7.source0.css",
    "bytes": 677,
    "sha256": "2540b516e06a5a045a439a616088aad4e3df930507cda6e1b736fe9557cb5f29"
  },
  {
    "file": "union.actual-panel_8.source0.css",
    "bytes": 677,
    "sha256": "a83c26964d994402b3c5d6735fb1ab9a23130e9feba7ea09585b2490e361ae9b"
  },
  {
    "file": "union.actual-panel_9.source0.css",
    "bytes": 677,
    "sha256": "7f361cb166f9ad6d45d6d2d2a2014ebb02e2bb711f805e1a2753d601c55b7258"
  },
  {
    "file": "union.actual-panel_10.source0.css",
    "bytes": 682,
    "sha256": "1f79e57ce728011ea1223f185fb12c509496e5767c2dc38613c931f0570dcd6f"
  },
  {
    "file": "union.actual-panel_11.source0.css",
    "bytes": 682,
    "sha256": "9221781ed08b42722a8f347f4b6b16b782cc9ada0dcfcbcc767a13e200922c9a"
  },
  {
    "file": "union.actual-panel_12.source0.css",
    "bytes": 682,
    "sha256": "4e4e06b597d2c5a31b54923094c5ab047946a6181452d45fba213e8aa6776def"
  },
  {
    "file": "union.actual-panel_13.source0.css",
    "bytes": 682,
    "sha256": "c01fba4a949376e25783976d52f37690fd0ed9384bdbc3e84e9f4e71e2ce7a0a"
  },
  {
    "file": "union.actual-panel_14.source0.css",
    "bytes": 682,
    "sha256": "bece047216265c3766ea88e7365e10c9df5f04bfcdd6610b397fb323c5303efa"
  },
  {
    "file": "union.actual-panel_15.source0.css",
    "bytes": 682,
    "sha256": "53b387a7cb10813da4999f86ecb2e86eacdda5e9f2afb1a84dccabf34675f75c"
  },
  {
    "file": "union.actual-panel_16.source0.css",
    "bytes": 682,
    "sha256": "523bbcec900a4086c1ad3ff153a41f4b2c77eee13094afe09b40db66d04e2ccd"
  },
  {
    "file": "union.actual-panel_17.source0.css",
    "bytes": 682,
    "sha256": "7e54aea5081aede47aab8ea223168f6a7165e2f9492daa2b6cf3d630331179fe"
  },
  {
    "file": "union.actual-panel_18.source0.css",
    "bytes": 682,
    "sha256": "5462d1275c2aaabd47305d163b27821165f03e02c93b0130a1390396085ce23e"
  },
  {
    "file": "union.actual-panel_19.source0.css",
    "bytes": 682,
    "sha256": "91243a38c35e1b2bf98289cacd723ac77d4c5638a46195f504ca847e25657a4a"
  },
  {
    "file": "union.actual-panel_20.source0.css",
    "bytes": 682,
    "sha256": "6c45877a209f0d733d879f9ed426bb841297859613a2431a4c31ca55bb32d16b"
  },
  {
    "file": "union.actual-panel_21.source0.css",
    "bytes": 682,
    "sha256": "b9438b08011135f2733605dcc9fc38631e3157f128dcbe0bb0807d62004b7257"
  },
  {
    "file": "union.actual-panel_22.source0.css",
    "bytes": 682,
    "sha256": "ec20c9ae8fdf0048b109e412624577ec9d044514d3f9faa38605d98d50cb7cda"
  },
  {
    "file": "union.actual-panel_23.source0.css",
    "bytes": 682,
    "sha256": "32fd5cca1607b56e67382fb267a8ee726d51c211ece4ccdb14ca302b229e29e5"
  },
  {
    "file": "union.actual-panel_24.source0.css",
    "bytes": 682,
    "sha256": "da7ab582239f2394ae0678e0afa5eed09f8205b009ba57f524c8dfa20fc8cc9f"
  },
  {
    "file": "union.actual-panel_25.source0.css",
    "bytes": 682,
    "sha256": "1df386a22cdf07ce2f841c1bee12d849f3d15b2c9e469991125daa3e19d22ddb"
  },
  {
    "file": "union.actual-panel_26.source0.css",
    "bytes": 682,
    "sha256": "cd8432df6dba8233093c9386d0acabeb1b55d313b76a263df31603301cda6008"
  },
  {
    "file": "union.actual-panel_27.source0.css",
    "bytes": 682,
    "sha256": "e5157111c47ed72c2503e9ef5ca2f1c3a9108e05df37afeba2be06b64af5d019"
  },
  {
    "file": "union.actual-panel_28.source0.css",
    "bytes": 682,
    "sha256": "2299f55370208ae92519b43b73742799cf1f9cc8f28add6d0c5f8d025df46695"
  },
  {
    "file": "union.actual-panel_29.source0.css",
    "bytes": 682,
    "sha256": "7da8fd3857a57d86eb30ac882493bdda4da5f016bddda893f93f0971439f4be8"
  },
  {
    "file": "union.actual-panel_30.source0.css",
    "bytes": 682,
    "sha256": "9f9de8757d423707c1fb281ba255226043ae3ac8fac772c7a05083977c20a973"
  },
  {
    "file": "union.actual-panel_31.source0.css",
    "bytes": 682,
    "sha256": "5adf372c394644f90490f1f9956737bf155c1b27cb565bb2d3d596330a52001d"
  },
  {
    "file": "union.actual-panel_32.source0.css",
    "bytes": 682,
    "sha256": "1df6ef1d999da025d3e4faf6294e054d01e36094ba7eb577344def864e0ff595"
  },
  {
    "file": "union.actual-panel_33.source0.css",
    "bytes": 682,
    "sha256": "b79266e57b0ca4c62e42208ece4e15c8477f28b0a3252326bc9dac9e65fd7bef"
  },
  {
    "file": "union.actual-panel_34.source0.css",
    "bytes": 682,
    "sha256": "914bf736118057e57cc55a098aa59465fe05756526a3243d4ac0a7f0be059eb9"
  },
  {
    "file": "union.actual-panel_35.source0.css",
    "bytes": 682,
    "sha256": "6dd53f0127e8c0daae951214cc7cf2b6df49934055a7d956597ff149c5b3de72"
  },
  {
    "file": "union.actual-panel_36.source0.css",
    "bytes": 682,
    "sha256": "7fa6732c9cad88769bd802475b56fd1654d3290107678f5ab8ea93c8d3848780"
  },
  {
    "file": "union.actual-panel_37.source0.css",
    "bytes": 682,
    "sha256": "377c153c6ac65919a0f01e38bcb8de0ff8b2eedd98de11d9410c5d2de8f2fec9"
  },
  {
    "file": "union.actual-panel_38.source0.css",
    "bytes": 682,
    "sha256": "371011550f2546b2e50924fc05397dd1f44cf139272ba217434f045529addbb1"
  },
  {
    "file": "union.actual-panel_39.source0.css",
    "bytes": 682,
    "sha256": "47c1fe5542909ad0fe91387b31db1901a6545cf9349be7cc65bca8d339becdc8"
  },
  {
    "file": "union.actual-panel_40.source0.css",
    "bytes": 682,
    "sha256": "b29d96b44f3c0ee79858582d9d22aa0dc5290781fb7f25ae74175cc98f6aa736"
  },
  {
    "file": "union.actual-panel_41.source0.css",
    "bytes": 682,
    "sha256": "8e0db91f34d6996cfca9b92ce8996e2e04725b600d39af0474adc8ceae807a91"
  },
  {
    "file": "identical.six-manual-supports-whole.source0.css",
    "bytes": 1223,
    "sha256": "896d5e6c8f1ae1fb60db674c99d2417ce2a577e37a1b8ecceccaa837502ab12d"
  },
  {
    "file": "a.six-manual-supports-whole.source0.css",
    "bytes": 1223,
    "sha256": "896d5e6c8f1ae1fb60db674c99d2417ce2a577e37a1b8ecceccaa837502ab12d"
  },
  {
    "file": "b.six-manual-supports-whole.source0.css",
    "bytes": 1211,
    "sha256": "fd84467266cd0d172832b46119e6196ccc32eca3acbce5bff11fe9bef13cf7e5"
  },
  {
    "file": "union_queries.authored-point-request.json",
    "bytes": 450190,
    "sha256": "a330bda8c44a7f86c37805f1d4b7a2ced99097f92fed14c84b30733b3f18f5a2"
  },
  {
    "file": "union_queries.owned-classification.json",
    "bytes": 459392,
    "sha256": "96fb2cb5edae5bc4791e1c27e859163bf985d43855662d4c73099b5fa5e9c423"
  },
  {
    "file": "union.actual-boolean.json",
    "bytes": 449577,
    "sha256": "a69ea9b8c4f99b902591f658086681ffefd6f12f2b0ee84515076bc259b857d0"
  },
  {
    "file": "union.authored-boolean-request.json",
    "bytes": 33792,
    "sha256": "6253c44c92c1aceda34c7099fed6b3298ba69abb618bb99030c1923006a114f2"
  },
  {
    "file": "cavity.actual-panel_0.source0.css",
    "bytes": 682,
    "sha256": "0671b3b96d827aa7f6fdc45af973f6dae7563c8468b076096f1a059b4da9ea36"
  },
  {
    "file": "cavity.actual-panel_1.source0.css",
    "bytes": 682,
    "sha256": "ff2a4280748ca6a0972f0d5eac62e2bfa0a9b14471454e6f0813fa9de6c69138"
  },
  {
    "file": "cavity.actual-panel_2.source0.css",
    "bytes": 682,
    "sha256": "52ab33ee983878a2c6365a19580d7c99aedeafcbee6fed085dff19d84785413f"
  },
  {
    "file": "cavity.actual-panel_3.source0.css",
    "bytes": 682,
    "sha256": "136b317ee3bf86df5a4aaa19e86438604164f761e19df95ff771a4588233646f"
  },
  {
    "file": "cavity.actual-panel_4.source0.css",
    "bytes": 682,
    "sha256": "d2934202e6541c71803a742424c2cf6a352b98521c6fd3a633a2c0617debce38"
  },
  {
    "file": "cavity.actual-panel_5.source0.css",
    "bytes": 682,
    "sha256": "6e5bafac53b3699e54c0970e39f8fc9e8932dbbc37d46793cc14f48602773214"
  },
  {
    "file": "cavity.actual-panel_6.source0.css",
    "bytes": 682,
    "sha256": "13c93f79e86da522bee5c9784166e69cde3d99269ef74ef29b8f1b043469c0f3"
  },
  {
    "file": "cavity.actual-panel_7.source0.css",
    "bytes": 682,
    "sha256": "4359bb8f344cd37604431dc910560bc587095763b7b0faabdc794649cd514113"
  },
  {
    "file": "cavity.actual-panel_8.source0.css",
    "bytes": 682,
    "sha256": "42ffcb9195d31669de09a8e568f0f49d705531240be8a54f16765159b3e54f44"
  },
  {
    "file": "cavity.actual-panel_9.source0.css",
    "bytes": 682,
    "sha256": "ec424fa69809d4b08c69d2204107a5a62cdad195c836c05f157df7ddf6f293e5"
  },
  {
    "file": "cavity.actual-panel_10.source0.css",
    "bytes": 687,
    "sha256": "e9be64c5f3ec1925bd329fc316bd7488c7a758f1495cb96b4bcb41acab9d27c0"
  },
  {
    "file": "cavity.actual-panel_11.source0.css",
    "bytes": 687,
    "sha256": "b75eb9bf5d55fc5fad1e53864035ce3d0cd457ecc8c5274452e9c974669ba729"
  },
  {
    "file": "cavity.actual-panel_12.source0.css",
    "bytes": 687,
    "sha256": "635cf525cfbc5af7eaf03efdb41dc7c26009797a2191dd4bbf7e49c1905ad512"
  },
  {
    "file": "cavity.actual-panel_13.source0.css",
    "bytes": 687,
    "sha256": "e5c067f7e1fdd18adfcbfdc5c66996822ce1ea6668bddcf91c0b41d542d7acce"
  },
  {
    "file": "cavity.actual-panel_14.source0.css",
    "bytes": 687,
    "sha256": "dfd8725880255de9c35738e9b9d858dec564a7baedb25efa292bf0ab65cfe52c"
  },
  {
    "file": "cavity.actual-panel_15.source0.css",
    "bytes": 687,
    "sha256": "bd1dd3545274c2d52a3de2e2c97a4cc423c9b9145121563237a7a64b8cd739ff"
  },
  {
    "file": "cavity.actual-panel_16.source0.css",
    "bytes": 687,
    "sha256": "76cd453ef7ca7d829dfe08b932dda61b181995553b39b732b8f47af68a79ebb0"
  },
  {
    "file": "cavity.actual-panel_17.source0.css",
    "bytes": 687,
    "sha256": "47ae7e885bde57261a07db46fc7585aea520de241c431978a1600ec336796197"
  },
  {
    "file": "cavity.actual-panel_18.source0.css",
    "bytes": 687,
    "sha256": "26463b89237b47aacbe774bcdd4be22ad4a5b1686ed005b145b4ef4a719b78d0"
  },
  {
    "file": "cavity.actual-panel_19.source0.css",
    "bytes": 687,
    "sha256": "01675e49c2e3801764b14facf4ae27f9fdfbcac7302fe7064020f2fa08b925b8"
  },
  {
    "file": "cavity.actual-panel_20.source0.css",
    "bytes": 687,
    "sha256": "6f3692bd976cb4125e11068490c82f017c1a733aa4c2b31d3982bb498cb176d0"
  },
  {
    "file": "cavity.actual-panel_21.source0.css",
    "bytes": 687,
    "sha256": "3857826411be8152e2aa2aa33056efa1d88475bd14e4a76ca1eb09dac43274e8"
  },
  {
    "file": "cavity.actual-panel_22.source0.css",
    "bytes": 687,
    "sha256": "0b39332878682f32eda1ca203534522dfe4187b3d3e72282cde4237ca2e55963"
  },
  {
    "file": "cavity.actual-panel_23.source0.css",
    "bytes": 687,
    "sha256": "c451c0fa679e7ff1fc132e597e64c1ffed3e41b5bccbdbf86c8d8993ba7e8ebc"
  },
  {
    "file": "cavity.actual-panel_24.source0.css",
    "bytes": 687,
    "sha256": "f6a89646a26c5cf7c3ecea1f57aa580fb98237f0408036ce224aa0fdf1547e9e"
  },
  {
    "file": "cavity.actual-panel_25.source0.css",
    "bytes": 687,
    "sha256": "d329fdcf38da2a96d7b5bc9c170b5a4d3e0ea15f45b4cf1417f69f29fc93f99d"
  },
  {
    "file": "cavity.actual-panel_26.source0.css",
    "bytes": 687,
    "sha256": "d5c9c66c7074935b02abafd1500beb07693f14bb7017893fff0b61ecbfbd734a"
  },
  {
    "file": "cavity.actual-panel_27.source0.css",
    "bytes": 687,
    "sha256": "7b86b7c85b8a289b82b2478578f247906d5b1547aede681d5856c1157ef95c6c"
  },
  {
    "file": "cavity.actual-panel_28.source0.css",
    "bytes": 687,
    "sha256": "e7175e813f4428996530acfae2e8ced38479c0b78e6ad92a184eefdc266522b1"
  },
  {
    "file": "cavity.actual-panel_29.source0.css",
    "bytes": 687,
    "sha256": "2333e6886194f8c90f19212416be52d0fe8f6ad1a233959ccb9cdc19c83f1f9e"
  },
  {
    "file": "cavity.actual-panel_30.source0.css",
    "bytes": 687,
    "sha256": "c764327fbb715830836d713f01eb45c6dd96f99bff4e8e618265ccff948b4db3"
  },
  {
    "file": "cavity.actual-panel_31.source0.css",
    "bytes": 687,
    "sha256": "bb41af76784a51e97991c7f3e6632625e57504e0a5f2c23967104283fa6f1b16"
  },
  {
    "file": "cavity.actual-panel_32.source0.css",
    "bytes": 687,
    "sha256": "79e950cde66da84c0d67ff73afad0c8a66c1bb06f88db7b9f08b707c36be01b9"
  },
  {
    "file": "cavity.actual-panel_33.source0.css",
    "bytes": 687,
    "sha256": "b9ed0aa44737f34bb8147da019f0c40036fb13244edb55db0e73c811e9fcc756"
  },
  {
    "file": "cavity.actual-panel_34.source0.css",
    "bytes": 687,
    "sha256": "6c51a56b08f30dd5d1ba3f17f3b12fecd0d3e79490ebe120b3e6462249b403b8"
  },
  {
    "file": "cavity.actual-panel_35.source0.css",
    "bytes": 687,
    "sha256": "3064d834478cf5aef76ba0e50e164ed95f374f7824c31b9590dcb9e1c65633a4"
  },
  {
    "file": "cavity.actual-panel_36.source0.css",
    "bytes": 687,
    "sha256": "1db259d805d6f33951fcb4df19be434f3ae4c84efa646100db7d4f1e9a3ee7a4"
  },
  {
    "file": "cavity.actual-panel_37.source0.css",
    "bytes": 687,
    "sha256": "0fe481a9815ab8aa8d3ec22062c3ffce886c6a8987d6a7519573a2178731cb76"
  },
  {
    "file": "cavity.actual-panel_38.source0.css",
    "bytes": 687,
    "sha256": "7c98e8b24cbf83abd1cc51db0e3fd3f986e6d40102eacfba8647f5d2e7237717"
  },
  {
    "file": "cavity.actual-panel_39.source0.css",
    "bytes": 687,
    "sha256": "e28e6fa40ccf71abbf3315e05eb10d17da89761e90e2738eae8835eb7609c510"
  },
  {
    "file": "cavity.actual-panel_40.source0.css",
    "bytes": 687,
    "sha256": "115a826d907f360a3354cf2a3c3635f4311c0f6197a068399ce7d56c67b9390e"
  },
  {
    "file": "cavity.actual-panel_41.source0.css",
    "bytes": 687,
    "sha256": "db0e1843fec5071ba425806305d94082038911f01c63b6331675dfb0ad5bff42"
  },
  {
    "file": "cavity.actual-panel_42.source0.css",
    "bytes": 687,
    "sha256": "ac31508785eb6e10814c73b6b0c34aff7acfe53f8c6b5663b1f0f0f6ba9d5d8c"
  },
  {
    "file": "cavity.actual-panel_43.source0.css",
    "bytes": 687,
    "sha256": "38dda4bd75244925011e9e066b6c3093f83bce3be4c892e420d21a7bde292b52"
  },
  {
    "file": "cavity.actual-panel_44.source0.css",
    "bytes": 687,
    "sha256": "218f80ad28df1bd5bc908772e3976904ab6ff773ca6ce7eb1825b8c8e5bd2cbf"
  },
  {
    "file": "cavity.actual-panel_45.source0.css",
    "bytes": 687,
    "sha256": "8e894c7883eb598591999bc0ea7a09aa8de3167f760ba92760e096796b998651"
  },
  {
    "file": "cavity.actual-panel_46.source0.css",
    "bytes": 687,
    "sha256": "7e1a2bcdbd1d88e9838a107217b842939f403ea2b322a0051ac75d9e30bb2ae9"
  },
  {
    "file": "cavity.actual-panel_47.source0.css",
    "bytes": 687,
    "sha256": "83e714405bbd1d5f416b4c67d409fef7ba0688131ea172c8fa57fd323b0288b6"
  },
  {
    "file": "cavity.actual-panel_48.source0.css",
    "bytes": 687,
    "sha256": "3fa35a21158354152e2a2332d0e688cfa75548ebbdbb918d32daec6ac24f7c43"
  },
  {
    "file": "cavity.actual-panel_49.source0.css",
    "bytes": 687,
    "sha256": "937280a71b4d4f9b974b56ac588d311f307bcf31f59ed821395ca4eaa9b89916"
  },
  {
    "file": "cavity.actual-panel_50.source0.css",
    "bytes": 687,
    "sha256": "ca43d13f11e17a94b6128aae4b8837cb428129ac97042b77d05cf261c785433a"
  },
  {
    "file": "cavity.actual-panel_51.source0.css",
    "bytes": 687,
    "sha256": "b911ab36de90e0b9a6c113257ee580a5cddaa4d5191a0013a1d421976a05000e"
  },
  {
    "file": "cavity.actual-panel_52.source0.css",
    "bytes": 687,
    "sha256": "b0babb03d62595a0c88122aebad5b3212c43126880cbbe2c37675bfd3bbd1dcb"
  },
  {
    "file": "cavity.actual-panel_53.source0.css",
    "bytes": 687,
    "sha256": "bef951c25115c390dd5f86367f332da2a27851ec9a5ffe2c8108a32f0049c673"
  },
  {
    "file": "cavity.actual-panel_54.source0.css",
    "bytes": 687,
    "sha256": "f9ded98c63d3811f4160ee3ddf85d3281c4fe528cb0b4bb2b238dc802aba310e"
  },
  {
    "file": "cavity.actual-panel_55.source0.css",
    "bytes": 687,
    "sha256": "536eac71d7e9b2ac4db61ff367d017a1c9147e0f13de84e353d3a4c72db4ac05"
  },
  {
    "file": "cavity.actual-panel_56.source0.css",
    "bytes": 687,
    "sha256": "5eb574f50089f5b0fc9d9055e81f72c3bae6dd9886479ebad3fd06d9aa159381"
  },
  {
    "file": "cavity.actual-panel_57.source0.css",
    "bytes": 687,
    "sha256": "2cfeebd63c1da1e99d24c40c5ffbd509423ee1e11f4d06064618701ad0cd9a89"
  },
  {
    "file": "cavity.actual-panel_58.source0.css",
    "bytes": 687,
    "sha256": "79dbf0a1392a28df95bbe2752bee8d6c17ee153500caf969dc24f3d1efea48ec"
  },
  {
    "file": "cavity.actual-panel_59.source0.css",
    "bytes": 687,
    "sha256": "a7c2160c6aada0d7afea8e239e70e4dc718e389ea5e55a0ae1c488c8395159d4"
  },
  {
    "file": "outer.six-manual-supports-whole.source0.css",
    "bytes": 1211,
    "sha256": "1221fa07d365e10a3239a970b5972b984ade25ed6417465e60da4c4c0592e3ef"
  },
  {
    "file": "cavity_tool.six-manual-supports-whole.source0.css",
    "bytes": 1211,
    "sha256": "83a378d6f7a416c99026d5ddf2163a365a2821da417dfaec44e88ded5e970903"
  },
  {
    "file": "cavity_queries.authored-point-request.json",
    "bytes": 634264,
    "sha256": "dca9a874a928776060a7b79d883b4057d56381dc393e816303341299e2457496"
  },
  {
    "file": "cavity_queries.owned-classification.json",
    "bytes": 638486,
    "sha256": "38dbc023da48b65716fcee63321ce0d35a2ad9bd97ae7959dfc056f39e9ac2fc"
  },
  {
    "file": "cavity.actual-boolean.json",
    "bytes": 634018,
    "sha256": "2c1fc9f6680148625eb3db0fe6567beeaa2dc828658ff5b8f6ab35c65335ae00"
  },
  {
    "file": "cavity.authored-boolean-request.json",
    "bytes": 33760,
    "sha256": "cb9e9a868bf04c7e8cc1a5943ef49b888b45ba231e3e122e31f4453412f8da4e"
  },
  {
    "file": "through.actual-panel_0.source0.css",
    "bytes": 687,
    "sha256": "3c175322d9aca91833e1c38d2a0bc91930995fe14e400c8bff135de8a4ab3ca1"
  },
  {
    "file": "through.actual-panel_1.source0.css",
    "bytes": 687,
    "sha256": "7bf0c899c2401a6a4e612e9c99815373fb25e0e56d2435215ba8885900735866"
  },
  {
    "file": "through.actual-panel_2.source0.css",
    "bytes": 687,
    "sha256": "f20d717e6978470e1c8877665c6a7f70b9d937e1b981962f619dff534c252712"
  },
  {
    "file": "through.actual-panel_3.source0.css",
    "bytes": 687,
    "sha256": "974a1ce95212e79a454e94400ee2ca19a8e79514b52d232637d71d6a1a69722b"
  },
  {
    "file": "through.actual-panel_4.source0.css",
    "bytes": 687,
    "sha256": "9be8f9bc2793eb84234c5bd6779461c4cfed20a77eeaed1361f0c8ef9b9b6493"
  },
  {
    "file": "through.actual-panel_5.source0.css",
    "bytes": 687,
    "sha256": "57541f454df1e8d0926daff21dd72242f0dd36011d7104cbe48ed83d97567417"
  },
  {
    "file": "through.actual-panel_6.source0.css",
    "bytes": 687,
    "sha256": "492932984d0c6e44d362ac8c4ad134a026dad78b8e7bba8df16ba092be468710"
  },
  {
    "file": "through.actual-panel_7.source0.css",
    "bytes": 687,
    "sha256": "4fe7f860d546011fe665dc785ea928a2ef4d9dc3a8c2a7e7619725042cbd8290"
  },
  {
    "file": "through.actual-panel_8.source0.css",
    "bytes": 687,
    "sha256": "fadc051ddd53813c3a74f0bd72ca82daf1d635a07c14a286ef5d57d4157800af"
  },
  {
    "file": "through.actual-panel_9.source0.css",
    "bytes": 687,
    "sha256": "b6e84a9a3c491e1502fcf6822e50fd23b463eb9292ad9975e5f9daf0eb9a2786"
  },
  {
    "file": "through.actual-panel_10.source0.css",
    "bytes": 692,
    "sha256": "f352e40489086be1d86fd95014a51c6f371598380059c77218c77de046f867c6"
  },
  {
    "file": "through.actual-panel_11.source0.css",
    "bytes": 692,
    "sha256": "dbfea4360750f1704f0cded311118ad4068cfe320e7e1e6ea21239d8fc7cef31"
  },
  {
    "file": "through.actual-panel_12.source0.css",
    "bytes": 692,
    "sha256": "4e2a5c46ea34fd2a697753e0a8ce50d5c0a9a06e68170d0c75eeb3ae3aa0f98f"
  },
  {
    "file": "through.actual-panel_13.source0.css",
    "bytes": 692,
    "sha256": "d1cb8c665099b4f06303c52affa8ecb61878c88fb90ffe50230dab0e3993884e"
  },
  {
    "file": "through.actual-panel_14.source0.css",
    "bytes": 692,
    "sha256": "60859f6656f1a32e66699bd1c8936308bab5b9c821c9b51bf5f046b7848ba092"
  },
  {
    "file": "through.actual-panel_15.source0.css",
    "bytes": 692,
    "sha256": "9eed804b12e27704ae7e996b3fdf421797826eb1bf20d3e349069f958a3bf6be"
  },
  {
    "file": "through.actual-panel_16.source0.css",
    "bytes": 692,
    "sha256": "d222e7292cf7b6f371625f5bd114f3c35d3402155d9e12fb02e8a2476dc309c7"
  },
  {
    "file": "through.actual-panel_17.source0.css",
    "bytes": 692,
    "sha256": "638d97f84c0bdc9ca8a9b59e8122d484faae4a6747484a5a50e361f59b6a5607"
  },
  {
    "file": "through.actual-panel_18.source0.css",
    "bytes": 692,
    "sha256": "1446e86f5e92f3a5a60fa1e5cf54970ba237ec1203b5668c779486fde2a95119"
  },
  {
    "file": "through.actual-panel_19.source0.css",
    "bytes": 692,
    "sha256": "9d51f80e5d106a02ee3dbea5bd3fd2d3c5b592d63c9fd3f3dd43ed525a0ce386"
  },
  {
    "file": "through.actual-panel_20.source0.css",
    "bytes": 692,
    "sha256": "a824d23a30113a3da44c90ddb966923fc53d875c58403dc47a072f03e2b7d903"
  },
  {
    "file": "through.actual-panel_21.source0.css",
    "bytes": 692,
    "sha256": "8cd846ace58e617083abcb96cb35fa868f0fae4dcb7c785203a41c73a853ed28"
  },
  {
    "file": "through.actual-panel_22.source0.css",
    "bytes": 692,
    "sha256": "783a3bdbf8d60ee3c217e23feb68bb8d08e0b193ab7061b0ef8df546e9fe2d63"
  },
  {
    "file": "through.actual-panel_23.source0.css",
    "bytes": 692,
    "sha256": "39e41345be5d5f6aa6055a983138cbd78947a090305f97c615b8d83f9ab84833"
  },
  {
    "file": "through.actual-panel_24.source0.css",
    "bytes": 692,
    "sha256": "cb81e493d5a0e93b641f26c9bccdc3b1f05a5514f507fa78af34e8c4b9630c56"
  },
  {
    "file": "through.actual-panel_25.source0.css",
    "bytes": 692,
    "sha256": "5adf5d84e6a181445a7685b16494baf31c557abc4d699f1430b3cf45385ae2fa"
  },
  {
    "file": "through.actual-panel_26.source0.css",
    "bytes": 692,
    "sha256": "a8ba050e8d4b1b839d78bdcbc74fed950acdc53bb41b30a95eea74205ebcc0ab"
  },
  {
    "file": "through.actual-panel_27.source0.css",
    "bytes": 692,
    "sha256": "8fef38e32187d035f4e5b36d5b9ca33c0e59238466f380a50ad50dc7fea2f7eb"
  },
  {
    "file": "through.actual-panel_28.source0.css",
    "bytes": 692,
    "sha256": "27a2dca397d3d68e2f2f87d525bdea190fbd6fc3d710ef806324e329792995a9"
  },
  {
    "file": "through.actual-panel_29.source0.css",
    "bytes": 692,
    "sha256": "c367062d44fd2bf63c164e2c4e7581c9f73ca7a0354599689bce2df6ddcb7913"
  },
  {
    "file": "through.actual-panel_30.source0.css",
    "bytes": 692,
    "sha256": "790949d7b4fbbd2315a8780c545de3b6f278cdc0440b9709b3ac96a7bcb7dde9"
  },
  {
    "file": "through.actual-panel_31.source0.css",
    "bytes": 692,
    "sha256": "2bb33d7be2c2a537b2ea0da64c277d003599314227172ef7e50213a5ec0899dc"
  },
  {
    "file": "plate.six-manual-supports-whole.source0.css",
    "bytes": 1211,
    "sha256": "ff2c636dc6e938e81f5a335cda10dde410874a9604251456569cc0903d0d85ba"
  },
  {
    "file": "through_tool.six-manual-supports-whole.source0.css",
    "bytes": 1223,
    "sha256": "a8434ac629b19dcada1499374727c95c6980bc3aa5b6645ba932ce488a7f16a9"
  },
  {
    "file": "through_queries.authored-point-request.json",
    "bytes": 363093,
    "sha256": "aa3b2300281e622ba06e028f10963423135e1d80c4b843fd41a31160fa933cee"
  },
  {
    "file": "through_queries.owned-classification.json",
    "bytes": 369273,
    "sha256": "6c9cea781b2630e36e69418f883bfa110c4140efb9410d823aeee95c9c07fb71"
  },
  {
    "file": "through.actual-boolean.json",
    "bytes": 362789,
    "sha256": "b6cc639dc5dbd8234560ba4a9c0d18850622e761f1f04be9918bfc8cb348da96"
  },
  {
    "file": "through.authored-boolean-request.json",
    "bytes": 33828,
    "sha256": "27dce6739e5ab1f3bdb4d83dcc350b60a52653e96e703e7886ebe3e0e5256a9c"
  },
  {
    "file": "sever.actual-panel_0.source0.css",
    "bytes": 677,
    "sha256": "de693c378983e4ebef79229e5999febd92e85e3a25e5ea8e4b27ab0131fabe33"
  },
  {
    "file": "sever.actual-panel_1.source0.css",
    "bytes": 677,
    "sha256": "22af2e59b60ea4808d5ad26c9cb8c0bf178efcc16133dafc2b5efdbd6f944e70"
  },
  {
    "file": "sever.actual-panel_2.source0.css",
    "bytes": 677,
    "sha256": "b99a902ad2b4d13f4901c8c2e812a9d63cc5a3fbd85b27c944b37cfde0fe9935"
  },
  {
    "file": "sever.actual-panel_3.source0.css",
    "bytes": 677,
    "sha256": "9c3616d736476cc5a1b2bf84438a32be0cacd2986894f1a5ac3a0658283c7bec"
  },
  {
    "file": "sever.actual-panel_4.source0.css",
    "bytes": 677,
    "sha256": "d61d2394240fba56a7f025f18f9a9d152d27f1dfbd5e9a9e9503dad85b46d3f6"
  },
  {
    "file": "sever.actual-panel_5.source0.css",
    "bytes": 677,
    "sha256": "f9258db946dca0b94c46e8667ebfc47035e71fc2c244a685360d767dc818fcb8"
  },
  {
    "file": "sever.actual-panel_6.source0.css",
    "bytes": 677,
    "sha256": "01fde2228520e751d423bcdb1350234d72b9777692e81cae74ff62c4b834a5c3"
  },
  {
    "file": "sever.actual-panel_7.source0.css",
    "bytes": 677,
    "sha256": "9caaaf40851faf6d78ca196612fafd3ae12fc66b88c649f0f60b7ab8c5857827"
  },
  {
    "file": "sever.actual-panel_8.source0.css",
    "bytes": 677,
    "sha256": "83affbc8c1433a3c9e5e0e1931bfebb54d0bc48e333f12ec0e591e45d850add2"
  },
  {
    "file": "sever.actual-panel_9.source0.css",
    "bytes": 677,
    "sha256": "4c4a27551c20d952019eb3c15907e813a396f2a858781898bfa10e6175afdcb6"
  },
  {
    "file": "sever.actual-panel_10.source0.css",
    "bytes": 682,
    "sha256": "791b7d7a9000c58d601408f89632c778299ad5f64b0787b12244f51728e5f6d0"
  },
  {
    "file": "sever.actual-panel_11.source0.css",
    "bytes": 682,
    "sha256": "01f11a3fc095a80d175feb738d346275a04be108e16a34f24a5589391f855444"
  },
  {
    "file": "slab.six-manual-supports-whole.source0.css",
    "bytes": 1211,
    "sha256": "5e3ae70a34fbd65e589c7cc3ceca23d6039c7a3c0d8d37902abd11615a0212cd"
  },
  {
    "file": "sever_tool.six-manual-supports-whole.source0.css",
    "bytes": 1235,
    "sha256": "d187a3b9d8806cc9282550f555d1c4e0b4dbbc7e911a57b4d7545d4d079f3e45"
  },
  {
    "file": "sever_queries.authored-point-request.json",
    "bytes": 160611,
    "sha256": "56d461db215cfac7b44d8c4f96d4fca522be43206fd36c2a450bcd1eae854b1b"
  },
  {
    "file": "sever_queries.owned-classification.json",
    "bytes": 165369,
    "sha256": "83155417262188742b5de8df8c4752856289276b221930cfd1461ebe2ecf4aba"
  },
  {
    "file": "sever.actual-boolean.json",
    "bytes": 160325,
    "sha256": "63136bed3de9819a66d92d4494346065f2a9f64551c2a29d6c163f8481c42041"
  },
  {
    "file": "sever.authored-boolean-request.json",
    "bytes": 33886,
    "sha256": "4b79e5bd4307a9f1436e98d4ae8c886219279d35a1067cb52a0b7d068a04664e"
  },
  {
    "file": "empty_queries.authored-point-request.json",
    "bytes": 41029,
    "sha256": "7a741dbe1bed8d0f383ce26a14c0f8f3444d086951fc0e07e78caeb94448d329"
  },
  {
    "file": "empty_queries.owned-classification.json",
    "bytes": 47109,
    "sha256": "910edee90bfa50d7b66a918b5f55a3d8feeaea17327ab9760eef2901f95804a0"
  },
  {
    "file": "empty.actual-boolean.json",
    "bytes": 40700,
    "sha256": "ec39b703540cab56ee2b92ccb38596c504fe00e2c5dd503cd93b6cde2e6eb782"
  },
  {
    "file": "empty.authored-boolean-request.json",
    "bytes": 33858,
    "sha256": "5744f22a3e1f647988d6d6e06b136637dc8c58d62407e540bd150540c1dc2c5e"
  }
]);

const OPERAND_FILES = {
  union: ['a.six-manual-supports-whole.source0.css', 'b.six-manual-supports-whole.source0.css'],
  cavity: ['outer.six-manual-supports-whole.source0.css', 'cavity_tool.six-manual-supports-whole.source0.css'],
  through: ['plate.six-manual-supports-whole.source0.css', 'through_tool.six-manual-supports-whole.source0.css'],
  sever: ['slab.six-manual-supports-whole.source0.css', 'sever_tool.six-manual-supports-whole.source0.css'],
  empty: ['a.six-manual-supports-whole.source0.css', 'identical.six-manual-supports-whole.source0.css'],
};
const COUNTS = { union: [42, 8], cavity: [60, 3], through: [32, 4], sever: [12, 4], empty: [0, 4] };
export function requireFact(value, message) { if (!value) throw new Error(message); }
export function sameNative(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, index) => sameNative(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameNative(a[key], b[key]));
  }
  return Object.is(a, b);
}
export function assertNative(a, b, label) { requireFact(sameNative(a, b), label); }
export function assertBuffer(a, b, label) {
  requireFact(a?.length === b?.length && Array.from(a).every((value, index) => Object.is(value, b[index])), label);
}
export function createNativeOptions() {
  return { sourceVersion: 0, countU: 2, countV: 2, unitsPerMillimeter: 0.001,
    nativeCapacity: { version: 1, maximumObjects: 16 } };
}
export async function loadCase(key, readText) {
  requireFact(CASE_KEYS.includes(key), 'Unknown original Boolean family');
  const pins = PINS.filter(pin => pin.file.startsWith(key + '.') || pin.file.startsWith(key + '_queries.') || OPERAND_FILES[key].includes(pin.file));
  const originalTexts = new Map(await Promise.all(pins.map(async pin => {
    const text = await readText(pin.file);
    requireFact(typeof text === 'string', 'Expected original text input');
    const bytes = new TextEncoder().encode(text);
    requireFact(bytes.length <= 2 * 1024 * 1024, 'Input exceeds declared per-file host budget');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original Boolean input bytes/hash changed: ' + pin.file);
    return [pin.file, text];
  })));
  const request = JSON.parse(originalTexts.get(key + '_queries.authored-point-request.json'));
  const owned = JSON.parse(originalTexts.get(key + '_queries.owned-classification.json'));
  const boolean = JSON.parse(originalTexts.get(key + '.actual-boolean.json'));
  const booleanRequest = JSON.parse(originalTexts.get(key + '.authored-boolean-request.json'));
  assertNative(request.boolean, boolean, 'Request must retain coherent complete actual Boolean');
  assertNative(owned.boolean, boolean, 'Owned classification must retain Boolean field, not parent');
  const panelSources = new Map(boolean.panels.map((panel, index) => {
    const stored = boolean.sources.find(source => source.panelId === panel.id);
    requireFact(stored !== undefined, 'Original qualified panel source is absent');
    return [panel.id, { panelId: panel.id, sourceId: stored.sourceId,
      source: originalTexts.get(key + '.actual-panel_' + index + '.source0.css'), model: stored.model }];
  }));
  return { key, pins, request, owned, boolean, booleanRequest, panelSources,
    operandSources: OPERAND_FILES[key].map(file => originalTexts.get(file)), originalTexts };
}
export function coldModel(source) {
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  requireFact(compiled.ok, 'Actual original compiler refused: ' + JSON.stringify(compiled.diagnostics));
  return compiled.model;
}
export function panelQualification(boolean, panel) {
  const matches = boolean.shells.filter(shell => shell.panelIds.includes(panel.id));
  requireFact(matches.length === 1, 'Panel must belong to exactly one original Shell');
  const shell = matches[0], body = boolean.bodies.find(body => body.id === panel.bodyId);
  requireFact(body && body.shellIds.includes(shell.id) && shell.bodyId === body.id && shell.emptyRegionId === panel.emptyRegionId,
    'Original Body/Shell/panel association changed');
  return { panelId: panel.id, sourceId: panel.sourceId, bodyId: body.id, shellId: shell.id,
    emptyRegionId: panel.emptyRegionId, shellRole: shell.role,
    localFaceId: panel.bundle.topology.face.id, surfaceId: panel.bundle.topology.face.surfaceId };
}
export function proveCase(asset) {
  const requestBefore = structuredClone(asset.request), ownedBefore = structuredClone(asset.owned);
  assertNative(asset.request.boolean, asset.boolean, 'Coherent original request Boolean changed');
  assertNative(asset.owned.boolean, asset.boolean, 'Coherent owned Boolean changed');
  assertNative(validateAxisBoxSolidBoolean(asset.boolean), asset.boolean.report, 'Whole native Boolean validator differs');
  const classification = classifyAxisBoxSolidBooleanPoints(asset.boolean, asset.request.queries, asset.request.options);
  assertNative(classification, asset.owned, 'Whole actual point classification differs');
  assertNative(validateAxisBoxSolidBooleanPointClassification(asset.owned), asset.owned.report, 'Whole point validator differs');
  const boolean = classification.boolean;
  assertNative(asset.booleanRequest.a, boolean.a, 'Original operand A changed');
  assertNative(asset.booleanRequest.b, boolean.b, 'Original operand B changed');
  assertNative(asset.booleanRequest.options, boolean.options, 'Original Boolean options changed');
  const operandModels = asset.operandSources.map((source, index) => {
    requireFact(source === (index ? boolean.b.source : boolean.a.source), 'Original operand complete source text changed');
    const model = coldModel(source);
    requireFact(model.version === 0 && model.objects.length === 7, 'Original operand is version0 Model with seven objects');
    assertNative(model, boolean.originalModels[index], 'Whole original operand Model differs');
    return model;
  });
  requireFact(boolean.panels.length === COUNTS[asset.key][0] && classification.queries.length === COUNTS[asset.key][1], 'Original bounded case counts changed');
  requireFact(asset.panelSources.size === boolean.panels.length && boolean.sources.length === boolean.panels.length, 'Complete panel collection is required');
  const panelModels = boolean.panels.map(panel => {
    const actual = asset.panelSources.get(panel.id), stored = boolean.sources.find(source => source.panelId === panel.id);
    requireFact(actual && actual.panelId === panel.id && actual.sourceId === panel.sourceId && actual.source === stored.source,
      'Original qualified panel source changed');
    const model = coldModel(actual.source);
    assertNative(model, stored.model, 'Actual panel cold Model differs');
    assertNative(model, panel.bundle.geometry, 'Panel source/FaceBundle native geometry differs');
    requireFact(model.version === 0 && model.lengthUnit === 'mm' && model.objects.length === 5 &&
      model.objects.filter(object => object.kind === 'surface').length === 1 && model.objects.filter(object => object.kind === 'curve').length === 4,
    'Complete panel source must retain Surface and four native boundary Curves');
    const qualification = panelQualification(boolean, panel);
    requireFact(model.objects[0].id === qualification.surfaceId, 'Original Surface ID differs');
    return { panelId: panel.id, sourceId: panel.sourceId, source: actual.source, model, qualification };
  });
  requireFact(boolean.report.empty === (asset.key === 'empty'), 'Actual empty native state changed');
  requireFact(boolean.report.solid === (asset.key !== 'empty'), 'Restricted aggregate Solid flag changed');
  const controls = [];
  if (asset.key === 'cavity') {
    const result = classifyAxisBoxSolidBooleanPoints(boolean,
      [{ queryId: 'loader_cavity_eye', pointMM: [3, 3, 3] }],
      { evaluationId: 'loader_cavity_eye_classification', maximumQueries: 1 });
    assertNative(validateAxisBoxSolidBooleanPointClassification(result), result.report, 'Actual native camera-eye control validator differs');
    requireFact(result.classifications[0].status === 'outside' && result.classifications[0].emptyRegionIds.includes('cavity_void1'),
      'Camera-eye control is native outside-material/cavity-void, not a picking claim');
    controls.push({ name: 'cavity-camera-eye', result });
  }
  assertNative(asset.request, requestBefore, 'Original point request changed');
  assertNative(asset.owned, ownedBefore, 'Original whole classification changed');
  return { boolean, classification, operandModels, panelModels, controls };
}
