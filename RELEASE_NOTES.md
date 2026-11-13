# 1.1.0 — barre de VRAM, ouverture plus rapide

- **Barre de VRAM** dans la barre de titre, toujours visible : mémoire de la carte graphique utilisée sur le total, relevée toutes les 2 secondes. Verte, orange à partir de 90 %, rouge quand la carte sature.
- **Dans la carte d'entraînement**, la même barre en détail : charge de la carte, température, et le pic atteint depuis le lancement (un trait sur la barre).
- **Saturation réellement mesurée** : quand la VRAM est pleine, Windows déborde dans la mémoire vive et l'entraînement continue au ralenti. Lora Studio lit ce débordement, l'annonce avec le nombre de Go concernés et dit quoi faire (768 px, sans « Taille réelle des images », fermer ce qui occupe la carte).
- Au lancement d'un entraînement, si plus de 3 Go de VRAM sont déjà pris par d'autres programmes, le message de démarrage le signale.
- **Ouverture de l'atelier et « Actualiser » : environ 3 secondes de moins.** La vérification du tagger chargeait PyTorch pour rien ; les lectures du démarrage se font aussi en même temps au lieu de l'une après l'autre.
- **Vignettes** : chargées seulement quand elles approchent de l'écran, une seule fois par image (galerie et légendes partagent la même), lecture du fichier hors du fil principal.

# 1.0.0 — Lora Studio, l'atelier des LoRA à part

- **Entraînement** : l'atelier Lora de KaneApp, complet. On y retrouve projets, légendes, gestionnaire de tags, préréglage conseillé, file d'attente, cartes par époque et « Garder cette version ».
- **Merge** : LoRA + LoRA, checkpoints, LoRA → checkpoint, VAE + encodeur.
- Lora Studio utilise les moteurs de KaneApp (KaneAppData) et vos projets existants, sans rien copier.
- Il ne charge aucun checkpoint. Avant un entraînement, il libère la carte graphique en déchargeant le modèle du Studio de KaneApp, si celui-ci est démarré.
- « Essayer » envoie le LoRA et son déclencheur dans l'invite du Studio de KaneApp. Un double clic sur une image l'ouvre dans KaneApp.
