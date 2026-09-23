# Fotos de les capitals

Deixa aquí les fotos i executa `node build/scan-photos.mjs`.

El nom del fitxer pot ser el de la capital **o** el de la comarca. No importen accents,
majúscules, apòstrofs, articles ni guions — tots aquests noms funcionen:

    Berga.jpg        berga.png        Bergà.JPEG
    La Seu d'Urgell.jpg   la-seu-durgell.jpg   seu durgell.webp
    Figueres.jpg     Alt Empordà.jpg

Extensions acceptades: `.jpg .jpeg .png .webp`

Els originals no es toquen: l'script en fa una còpia reduïda a 800 px dins
`docs/img/capitals/`. Una capital sense foto no és cap error — la fitxa es mostra
només amb text.
