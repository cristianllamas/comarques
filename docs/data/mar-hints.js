// Hand-written content for the seas and gulfs. Which IHO sea areas make up each one is
// decided in build/fetch-geo-mar.mjs (the Mediterrani is nine of them, the Bàltic four).
//
// `ocea` is the ocean the sea belongs to, the answer to "A quin oceà pertany…?", by the
// IHO's grouping: the Mediterrani and the mar Negre belong to the Atlàntic. The Caspi has
// none — it is a closed sea, a lake — so the question is never asked about it.
// Names keep the generic noun in lower case (el mar Negre, el golf Pèrsic); the app
// capitalises it where it opens a line, and accepts the bare name ("Negre").
//
// Bays are left out on purpose, but the Bay of Bengal and the Bay of Biscay are gulfs in
// Catalan (el golf de Bengala, el mar Cantàbric), and are in.

export const HINTS = {
  // Atlàntic
  MED: { name: 'mar Mediterrani', art: 'el', ocea: 'Atlàntic',
         hook: 'El nostre mar, gairebé tancat entre Europa, Àsia i Àfrica. Només comunica amb l’Atlàntic per l’estret de Gibraltar.' },
  CAN: { name: 'mar Cantàbric', art: 'el', ocea: 'Atlàntic', accNom: ['golf de Biscaia', 'Biscaia'],
         hook: 'El mar del nord de la península Ibèrica, fins a la Bretanya. També es diu golf de Biscaia.' },
  NOR: { name: 'mar del Nord', art: 'el', ocea: 'Atlàntic',
         hook: 'Entre la Gran Bretanya, Noruega, Dinamarca i els Països Baixos. Hi ha plataformes de petroli i molts aerogeneradors.' },
  BAL: { name: 'mar Bàltic', art: 'el', ocea: 'Atlàntic',
         hook: 'Un mar poc salat al nord d’Europa, entre Suècia, Finlàndia i les repúbliques bàltiques. A l’hivern el nord es glaça.' },
  NEG: { name: 'mar Negre', art: 'el', ocea: 'Atlàntic',
         hook: 'Entre Europa i Àsia, tancat per Turquia. Comunica amb el Mediterrani per l’estret del Bòsfor, a Istanbul.' },
  CAR: { name: 'mar Carib', art: 'el', ocea: 'Atlàntic', accNom: ['mar de les Antilles', 'Antilles'],
         hook: 'Aigües càlides i turqueses entre les Antilles i l’Amèrica Central i del Sud. Terra de pirates i d’huracans.' },
  MEX: { name: 'golf de Mèxic', art: 'el', ocea: 'Atlàntic',
         hook: 'Gairebé tancat entre els Estats Units, Mèxic i Cuba. Hi neix el corrent del Golf, que escalfa Europa.' },
  GUI: { name: 'golf de Guinea', art: 'el', ocea: 'Atlàntic',
         hook: 'El gran racó de la costa occidental d’Àfrica. Al seu mig es creuen l’equador i el meridià de Greenwich.' },
  // Àrtic
  BAR: { name: 'mar de Barents', art: 'el', ocea: 'Àrtic', accNom: ['Barentsz'],
         hook: 'Al nord de Noruega i Rússia. Gràcies a un corrent càlid, la seva part sud no es glaça mai.' },
  BEA: { name: 'mar de Beaufort', art: 'el', ocea: 'Àrtic',
         hook: 'Al nord d’Alaska i del Canadà. Està cobert de gel la major part de l’any.' },
  // Índic
  ROI: { name: 'mar Roig', art: 'el', ocea: 'Índic', accNom: ['mar Vermell'],
         hook: 'Llarg i estret, entre Àfrica i la península Aràbiga. El canal de Suez l’uneix amb el Mediterrani.' },
  ARA: { name: 'mar d’Aràbia', art: 'el', ocea: 'Índic', accNom: ['mar Aràbic', 'mar Aràbiga', 'Aràbic'],
         hook: 'Entre la península Aràbiga i l’Índia. Per aquí navegaven els comerciants d’espècies.' },
  PER: { name: 'golf Pèrsic', art: 'el', ocea: 'Índic', accNom: ['golf Aràbic'],
         hook: 'Entre l’Iran i la península Aràbiga, ple de petroli. Només en surt per l’estret d’Ormuz.' },
  ADE: { name: 'golf d’Aden', art: 'el', ocea: 'Índic',
         hook: 'Entre el Iemen i Somàlia: la porta que porta del mar Roig a l’oceà Índic.' },
  BEN: { name: 'golf de Bengala', art: 'el', ocea: 'Índic', accNom: ['badia de Bengala'],
         hook: 'El gran golf a l’est de l’Índia, on desemboquen el Ganges i el Brahmaputra. El tigre de Bengala en pren el nom.' },
  // Pacífic
  BER: { name: 'mar de Bering', art: 'el', ocea: 'Pacífic',
         hook: 'Entre Rússia i Alaska. L’estret de Bering, al nord, separa Àsia d’Amèrica per només 82 km.' },
  OKH: { name: 'mar d’Okhotsk', art: 'el', ocea: 'Pacífic', accNom: ['Ojotsk'],
         hook: 'Gairebé tancat per Rússia, la península de Kamtxatka i les illes Kurils. A l’hivern s’hi forma gel.' },
  JAP: { name: 'mar del Japó', art: 'el', ocea: 'Pacífic', accNom: ['mar de l’Est'],
         hook: 'Entre el Japó, Corea i Rússia. Corea l’anomena mar de l’Est.' },
  GRO: { name: 'mar Groc', art: 'el', ocea: 'Pacífic',
         hook: 'Entre la Xina i la península de Corea. Rep el nom del fang groc que hi porta el riu Groc.' },
  XOR: { name: 'mar de la Xina Oriental', art: 'el', ocea: 'Pacífic', accNom: ['mar de la Xina Est', 'Xina Oriental'],
         hook: 'Entre la Xina, Taiwan, Corea i el sud del Japó. Hi desemboca el riu Iang-tsé.' },
  XME: { name: 'mar de la Xina Meridional', art: 'el', ocea: 'Pacífic', accNom: ['mar de la Xina del Sud', 'Xina Meridional'],
         hook: 'Entre la Xina, el Vietnam, les Filipines i Borneo. Molts països se’n disputen les illes.' },
  COR: { name: 'mar del Corall', art: 'el', ocea: 'Pacífic', accNom: ['Coral'],
         hook: 'Al nord-est d’Austràlia. Hi ha la Gran Barrera de Corall, l’estructura feta per éssers vius més gran del món.' },
  TAS: { name: 'mar de Tasmània', art: 'el', ocea: 'Pacífic', accNom: ['mar de Tasman', 'Tasman'],
         hook: 'Entre Austràlia i Nova Zelanda. Rep el nom de l’explorador Abel Tasman.' },
  // cap oceà
  CAS: { name: 'mar Caspi', art: 'el', ocea: null,
         hook: 'El llac més gran del món, tancat entre Europa i Àsia: no comunica amb cap oceà. Té aigua salada, com un mar.' },
};
