# Fotos

Una carpeta per tema: `cat/` (comarques), `esp/` (comunitats autònomes), `ue/` (Unió
Europea), `afr/` (Àfrica), `amn/` (Amèrica del Nord i Central), `ams/` (Amèrica del Sud)
i `asi/` (Àsia). Deixa-hi les fotos i executa `node build/scan-photos.mjs cat` (amb el nom
de la carpeta). Els oceans i els mars no tenen fotos.

Les fotos de tots els temes excepte `cat/` les baixa `node build/fetch-photos.mjs <tema>`
de Wikimedia Commons, a partir dels monuments triats a mà dins d'aquell script, i en desa
l'autor i la llicència a `credits.json`; l'app ho mostra sota la foto. Per canviar-ne una,
fixa-hi un fitxer concret amb `file:` a l'script.

El nom del fitxer pot ser el de la capital **o** el de la comarca. No importen accents,
majúscules, apòstrofs, articles ni guions — tots aquests noms funcionen:

    Berga.jpg        berga.png        Bergà.JPEG
    La Seu d'Urgell.jpg   la-seu-durgell.jpg   seu durgell.webp
    Figueres.jpg     Alt Empordà.jpg

Extensions acceptades: `.jpg .jpeg .png .webp`

Els originals no es toquen: l'script en fa una còpia reduïda a 800 px dins
`docs/img/<tema>/`. Una capital sense foto no és cap error — la fitxa es mostra
només amb text.
