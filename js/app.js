/* =========================================================
   NAYA | js/app.js
   Étape 4 sur 4 : panier, message WhatsApp, menu, animations, FAQ
   Sécurité : aucun innerHTML, aucun gestionnaire en ligne,
   prix lus dans un catalogue figé dans ce fichier (jamais dans la page),
   tout texte saisi est nettoyé avant d'entrer dans le message.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. Données figées ---------- */
  const CATALOGUE = Object.freeze({
    "bidon-1-5l": Object.freeze({ nom: "Bidon 1,5 L", prix: 2500 }),
    "bidon-1l": Object.freeze({ nom: "Bidon 1 L", prix: 2000 }),
    "sachet-200ml": Object.freeze({ nom: "Sachet 200 mL", prix: 300 })
  });

  const QUANTITE_MAX = 99;
  const CLE_STOCKAGE = "naya-commande";
  const VILLES_AUTORISEES = Object.freeze(["Calavi", "Cotonou"]);
  const NUMERO_PAR_DEFAUT = "2290152399315";

  const numeroWhatsApp = /^\d{8,15}$/.test(document.body.dataset.whatsapp || "")
    ? document.body.dataset.whatsapp
    : NUMERO_PAR_DEFAUT;

  /* ---------- 2. Outils ---------- */
  const $ = (selecteur, racine) => (racine || document).querySelector(selecteur);
  const $$ = (selecteur, racine) => Array.from((racine || document).querySelectorAll(selecteur));
  const possede = (objet, cle) => Object.prototype.hasOwnProperty.call(objet, cle);

  function formaterPrix(montant) {
    return String(Math.round(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
  }

  function nettoyerTexte(valeur, longueurMax) {
    return String(valeur || "")
      .normalize("NFC")
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, " ")
      .replace(/[*_~`<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, longueurMax);
  }

  /* Chaque module est isolé : une erreur dans l'un ne bloque pas les autres */
  function executer(nom, fonction) {
    try {
      fonction();
    } catch (erreur) {
      if (window.console) {
        console.error("Naya, module " + nom + " :", erreur);
      }
    }
  }

  /* ---------- 3. Apparition au défilement ---------- */
  executer("apparitions", function () {
    const elements = $$(".revele");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("est-visible"));
      return;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        entrees.forEach((entree) => {
          if (entree.isIntersecting) {
            entree.target.classList.add("est-visible");
            observateur.unobserve(entree.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    elements.forEach((el) => observateur.observe(el));
  });

  /* ---------- 4. En-tête compact au défilement ---------- */
  executer("entete", function () {
    const entete = $("#entete");
    if (!entete) return;
    let enAttente = false;

    function actualiser() {
      entete.classList.toggle("entete--compacte", window.scrollY > 12);
      enAttente = false;
    }

    function auDefilement() {
      if (enAttente) return;
      enAttente = true;
      window.requestAnimationFrame(actualiser);
    }

    window.addEventListener("scroll", auDefilement, { passive: true });
    actualiser();
  });

  /* ---------- 5. Menu mobile ---------- */
  executer("menu", function () {
    const bouton = $("#menu-bouton");
    const menu = $("#menu-mobile");
    if (!bouton || !menu) return;

    function definirMenu(ouvert) {
      menu.classList.toggle("est-ouvert", ouvert);
      bouton.setAttribute("aria-expanded", String(ouvert));
      bouton.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
      document.body.classList.toggle("menu-ouvert", ouvert);
    }

    bouton.addEventListener("click", () => {
      definirMenu(bouton.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", (evenement) => {
      if (evenement.target.closest("a")) definirMenu(false);
    });

    document.addEventListener("keydown", (evenement) => {
      if (evenement.key === "Escape" && menu.classList.contains("est-ouvert")) {
        definirMenu(false);
        bouton.focus();
      }
    });

    const grandEcran = window.matchMedia("(min-width: 960px)");
    const surChangement = (evenement) => {
      if (evenement.matches) definirMenu(false);
    };
    if (grandEcran.addEventListener) {
      grandEcran.addEventListener("change", surChangement);
    } else if (grandEcran.addListener) {
      grandEcran.addListener(surChangement);
    }
  });

  /* ---------- 6. Lien actif dans la navigation ---------- */
  executer("navigation", function () {
    if (!("IntersectionObserver" in window)) return;
    const liens = $$(".navigation__lien");
    const sections = liens
      .map((lien) => document.getElementById((lien.getAttribute("href") || "").slice(1)))
      .filter(Boolean);
    if (!sections.length) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        entrees.forEach((entree) => {
          if (!entree.isIntersecting) return;
          liens.forEach((lien) => {
            const actif = lien.getAttribute("href") === "#" + entree.target.id;
            lien.setAttribute("aria-current", actif ? "true" : "false");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((section) => observateur.observe(section));
  });

  /* ---------- 7. Vidéo du hero ---------- */
  executer("video", function () {
    const video = $(".hero__video");
    if (!video) return;

    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connexion = navigator.connection || {};
    const economieDonnees = connexion.saveData === true || /2g$/.test(connexion.effectiveType || "");

    /* On garde seulement l'image fixe : rien n'est téléchargé */
    if (mouvementReduit || economieDonnees) {
      video.removeAttribute("autoplay");
      video.pause();
      $$("source", video).forEach((source) => source.remove());
      video.load();
      return;
    }

    /* Pause hors de l'écran pour économiser la batterie */
    if ("IntersectionObserver" in window) {
      const observateur = new IntersectionObserver(
        (entrees) => {
          entrees.forEach((entree) => {
            if (entree.isIntersecting) {
              const lecture = video.play();
              if (lecture && lecture.catch) lecture.catch(() => {});
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.05 }
      );
      observateur.observe(video);
    }
  });

  /* ---------- 8. FAQ : une seule réponse ouverte à la fois ---------- */
  executer("faq", function () {
    const elements = $$(".faq__element");
    elements.forEach((element) => {
      element.addEventListener("toggle", () => {
        if (!element.open) return;
        elements.forEach((autre) => {
          if (autre !== element) autre.open = false;
        });
      });
    });
  });

  /* ---------- 9. Commande et WhatsApp ---------- */
  executer("commande", function () {
    const listeProduits = $(".produits__liste");
    const cartes = $$("[data-produit]").filter((carte) => possede(CATALOGUE, carte.dataset.id));
    const listeCommande = $("#liste-commande");
    const commandeVide = $("#commande-vide");
    const totalCommande = $("#total-commande");
    const compteur = $("#compteur-panier");
    const barre = $("#barre-panier");
    const barreQuantite = $("#barre-quantite");
    const barreTotal = $("#barre-total");
    const recapitulatif = $("#commande");
    const formulaire = $("#formulaire-commande");
    const boutonCommander = $("#bouton-commander");
    if (!listeProduits || !formulaire || !boutonCommander) return;

    const champNom = $("#champ-nom");
    const champVille = $("#champ-ville");
    const champQuartier = $("#champ-quartier");
    const champJour = $("#champ-jour");
    const erreurNom = $("#erreur-nom");
    const erreurQuartier = $("#erreur-quartier");

    const identifiants = Object.keys(CATALOGUE);
    const quantites = {};
    identifiants.forEach((id) => {
      quantites[id] = 0;
    });

    let recapitulatifVisible = false;
    let envoiEnCours = false;

    /* Reprise de la commande si la page est rechargée (données vérifiées) */
    try {
      const enregistre = JSON.parse(window.sessionStorage.getItem(CLE_STOCKAGE) || "null");
      if (enregistre && typeof enregistre === "object") {
        identifiants.forEach((id) => {
          const valeur = enregistre[id];
          if (Number.isInteger(valeur) && valeur >= 0 && valeur <= QUANTITE_MAX) {
            quantites[id] = valeur;
          }
        });
      }
    } catch (erreur) {
      /* stockage indisponible : on continue sans */
    }

    function sauvegarder() {
      try {
        window.sessionStorage.setItem(CLE_STOCKAGE, JSON.stringify(quantites));
      } catch (erreur) {
        /* stockage indisponible : on continue sans */
      }
    }

    function calculer() {
      let nombre = 0;
      let total = 0;
      identifiants.forEach((id) => {
        nombre += quantites[id];
        total += quantites[id] * CATALOGUE[id].prix;
      });
      return { nombre: nombre, total: total };
    }

    function actualiserBarre(nombre) {
      if (!barre) return;
      barre.hidden = nombre === 0 || recapitulatifVisible;
    }

    function actualiser() {
      const resume = calculer();

      cartes.forEach((carte) => {
        const id = carte.dataset.id;
        const sortie = $(".quantite__valeur", carte);
        if (sortie) sortie.textContent = String(quantites[id]);
        carte.dataset.actif = quantites[id] > 0 ? "true" : "false";
      });

      if (listeCommande) {
        listeCommande.replaceChildren();
        identifiants.forEach((id) => {
          const quantite = quantites[id];
          if (quantite === 0) return;
          const ligne = document.createElement("li");
          const nom = document.createElement("span");
          nom.className = "ligne__nom";
          nom.textContent = quantite + " \u00D7 " + CATALOGUE[id].nom;
          const prix = document.createElement("span");
          prix.className = "ligne__prix";
          prix.textContent = formaterPrix(quantite * CATALOGUE[id].prix);
          ligne.append(nom, prix);
          listeCommande.appendChild(ligne);
        });
      }

      if (commandeVide) commandeVide.hidden = resume.nombre > 0;
      if (totalCommande) totalCommande.textContent = formaterPrix(resume.total);

      if (compteur) {
        compteur.textContent = String(resume.nombre);
        compteur.dataset.vide = resume.nombre === 0 ? "true" : "false";
      }

      if (barreQuantite) {
        barreQuantite.textContent = resume.nombre + (resume.nombre > 1 ? " articles" : " article");
      }
      if (barreTotal) barreTotal.textContent = formaterPrix(resume.total);

      boutonCommander.disabled = resume.nombre === 0;
      actualiserBarre(resume.nombre);
    }

    /* Clics sur + et - (un seul écouteur pour toute la liste) */
    listeProduits.addEventListener("click", (evenement) => {
      const bouton = evenement.target.closest("[data-action]");
      if (!bouton) return;
      const carte = bouton.closest("[data-produit]");
      if (!carte || !possede(CATALOGUE, carte.dataset.id)) return;

      const action = bouton.dataset.action;
      const variation = action === "augmenter" ? 1 : action === "diminuer" ? -1 : 0;
      if (variation === 0) return;

      const id = carte.dataset.id;
      quantites[id] = Math.min(QUANTITE_MAX, Math.max(0, quantites[id] + variation));
      sauvegarder();
      actualiser();
    });

    /* La barre mobile se cache quand le récapitulatif est déjà à l'écran */
    if (recapitulatif && "IntersectionObserver" in window) {
      const observateur = new IntersectionObserver(
        (entrees) => {
          recapitulatifVisible = entrees.some((entree) => entree.isIntersecting);
          actualiserBarre(calculer().nombre);
        },
        { threshold: 0.15 }
      );
      observateur.observe(recapitulatif);
    }

    /* Validation du formulaire */
    function marquer(champ, erreur, invalide) {
      const conteneur = champ.closest(".formulaire__champ");
      if (conteneur) conteneur.dataset.invalide = invalide ? "true" : "false";
      if (erreur) erreur.hidden = !invalide;
      champ.setAttribute("aria-invalid", invalide ? "true" : "false");
    }

    function valider() {
      const nom = nettoyerTexte(champNom.value, 60);
      const quartier = nettoyerTexte(champQuartier.value, 80);
      const ville = VILLES_AUTORISEES.indexOf(champVille.value) !== -1 ? champVille.value : "";
      const jour = champJour ? nettoyerTexte(champJour.value, 40) : "";

      const nomInvalide = nom.length < 2;
      const quartierInvalide = quartier.length < 2;
      marquer(champNom, erreurNom, nomInvalide);
      marquer(champQuartier, erreurQuartier, quartierInvalide);

      if (nomInvalide) {
        champNom.focus();
        return null;
      }
      if (quartierInvalide) {
        champQuartier.focus();
        return null;
      }
      if (!ville) return null;

      return { nom: nom, quartier: quartier, ville: ville, jour: jour };
    }

    [champNom, champQuartier].forEach((champ) => {
      champ.addEventListener("input", () => {
        marquer(champ, champ === champNom ? erreurNom : erreurQuartier, false);
      });
    });

    /* Construction du message */
    function construireMessage(donnees) {
      const lignes = ["Bonjour Naya \u{1F44B}", "Je souhaite commander :"];
      let total = 0;

      identifiants.forEach((id) => {
        const quantite = quantites[id];
        if (quantite === 0) return;
        const sousTotal = quantite * CATALOGUE[id].prix;
        total += sousTotal;
        lignes.push("- " + quantite + " x " + CATALOGUE[id].nom + " : " + formaterPrix(sousTotal));
      });

      lignes.push("Total des produits : " + formaterPrix(total));
      lignes.push("");
      lignes.push("Nom : " + donnees.nom);
      lignes.push("Livraison : " + donnees.quartier + ", " + donnees.ville);
      if (donnees.jour) lignes.push("Jour souhaité : " + donnees.jour);
      lignes.push("");
      lignes.push("Merci !");
      return lignes.join("\n");
    }

    function ouvrirWhatsApp(message) {
      const adresse = "https://wa.me/" + numeroWhatsApp + "?text=" + encodeURIComponent(message);
      const lien = document.createElement("a");
      lien.href = adresse;
      lien.target = "_blank";
      lien.rel = "noopener noreferrer";
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
    }

    formulaire.addEventListener("submit", (evenement) => {
      evenement.preventDefault();
      if (envoiEnCours || calculer().nombre === 0) return;

      const donnees = valider();
      if (!donnees) return;

      envoiEnCours = true;
      ouvrirWhatsApp(construireMessage(donnees));
      window.setTimeout(() => {
        envoiEnCours = false;
      }, 2000);
    });

    actualiser();
  });
})();