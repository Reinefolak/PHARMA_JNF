// Exemple pour ajouter un client
async function ajouterClient(nom, email) {
  await fetch('http://localhost:3000/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, email })
  });
  alert("Client ajouté !");
}

// Exemple pour afficher les pharmacies
async function afficherPharmacies() {
  const res = await fetch('http://localhost:3000/pharmacies');
  const pharmacies = await res.json();
  console.log(pharmacies);
}
