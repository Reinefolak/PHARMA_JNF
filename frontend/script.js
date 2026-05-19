// === CLIENTS ===
async function ajouterClient(nom, email) {
  await fetch('http://localhost:3000/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, email })
  });
  alert("✅ Client ajouté !");
}

async function rechercherClient(nom) {
  const res = await fetch(`http://localhost:3000/clients?nom=${nom}`);
  const data = await res.json();
  console.log("Résultat recherche client:", data);
  return data;
}

// === PHARMACIES ===
async function ajouterPharmacie(nom, adresse) {
  await fetch('http://localhost:3000/pharmacies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, adresse })
  });
  alert("✅ Pharmacie ajoutée !");
}

async function rechercherPharmacie(nom) {
  const res = await fetch(`http://localhost:3000/pharmacies?nom=${nom}`);
  const data = await res.json();
  console.log("Résultat recherche pharmacie:", data);
  return data;
}
