// Helpers pour générer le fichier texte de log commande
// Les 6 premières lignes sont fixes et doivent toujours être présentes.
const LOG_HEADER_LINES = [
  '01',
  'F50000000001+',
  'F50000000001+',
  'F50000000001+',
  'H.05800002+',
  '00000001.24+',
];

/**
 * Formate l'IFLS sur 13 chiffres en appliquant le padding demandé.
 * - On récupère les 6 derniers chiffres (IFLS) en complétant avec un zéro devant si besoin.
 * - On préfixe avec des zéros pour atteindre 13 chiffres au total.
 */
export function formatIflsCode(ifls) {
  const numeric = Number(ifls);
  // Si la donnée est absente ou invalide, on retombe sur 0 pour éviter de planter la génération.
  if (Number.isNaN(numeric) || numeric < 0) {
    return '0000000000000';
  }
  const iflsPart = String(numeric).padStart(6, '0'); // IFLS = 6 chiffres (ajout d'un zéro si IFLS sur 5 chiffres)
  return `0000000${iflsPart}`.slice(-13); // padding global pour 13 chiffres
}

/**
 * Formate la quantité de cartons sur 4 chiffres avec padding gauche.
 */
export function formatCartonQuantity(cartons) {
  const qty = Math.max(0, Number(cartons) || 0);
  return String(qty).padStart(4, '0');
}

/**
 * Construit une ligne produit au format Axxxxxxxxxxxxx.yyyy+
 */
export function buildProduitLogLine(produit, cartons) {
  const iflsCode = formatIflsCode(produit?.ifls);
  const qty = formatCartonQuantity(cartons);
  return `A${iflsCode}.${qty}+`;
}

/**
 * Assemble l'intégralité du contenu texte : en-tête fixe + lignes produits.
 */
export function buildCommandeLogContent(commande) {
  const lignesProduits = (commande?.lignes || []).map((ligne) =>
    buildProduitLogLine(ligne.produit, ligne.cartons),
  );

  // On ajoute un \n final pour matcher le fichier modèle et faciliter la lecture
  return [...LOG_HEADER_LINES, ...lignesProduits].join('\n') + '\n';
}

/**
 * Génère un nom de fichier en respectant le pattern Txxxxxxx.xx.ddmmaaaa.hhmmss.txt
 * On réutilise l'id de commande pour avoir un identifiant, puis la date/heure courante.
 */
export function buildCommandeLogFileName(commande, now = new Date()) {
  const commandeIdBlock = `T${String(commande?.id || 0).padStart(7, '0')}`;
  const sequenceBlock = '01'; // bloc central resté fixe dans le modèle fourni

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const dateBlock = `${day}${month}${year}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeBlock = `${hours}${minutes}${seconds}`;

  return `${commandeIdBlock}.${sequenceBlock}.${dateBlock}.${timeBlock}.txt`;
}
