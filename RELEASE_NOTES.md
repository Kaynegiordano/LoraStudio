# 1.2.1 — nouvelle icône

- **Nouvelle icône** : un « L » en facettes plates sur fond bleu nuit, de la même famille que le K de KaneApp. Le fût rouge corail est celui du K ; le pied est coupé en deux facettes, jaune et cyan, comme ses deux bras. Chaque taille (16 à 256 px) est dessinée à sa taille pour rester nette dans la barre des tâches.

# 1.2.0 — barre de progression en couleur, thèmes

- **Barre de progression en couleur** pour l'entraînement et le Merge : plus haute, en dégradé (violet, bleu, vert) avec des rayures qui défilent pendant le travail, et le pourcentage à droite. Elle passe au vert quand c'est terminé, au rouge en cas d'erreur, à l'orange si vous arrêtez. Avant le premier pas : « Préparation… ».
- **Dans la barre des tâches de Windows** : l'icône de Lora Studio montre l'avancée de l'entraînement, même fenêtre réduite.
- **Thèmes** : bouton « Thème » dans la barre de titre, avec Sombre, Système (suit le mode clair ou sombre de Windows), Bleu (bleu nuit) et Clair. Le choix est retenu.

# 1.1.1 — durée estimée juste en « Taille réelle des images »

- **Durée annoncée trop longue** : avec « Taille réelle des images », la cadence mesurée au dernier entraînement était encore multipliée par 1,4, alors qu'elle avait déjà été mesurée en taille réelle. Exemple : 1 h 52 annoncée pour 1 h 20 réelle.
- **La durée suit maintenant la taille de vos images** : de très grandes images (3000 × 4096) s'entraînent vers 1280 × 1792, soit 2,2 fois la surface de 1024 px, et non « 40 % de plus ». Le préréglage l'annonce et donne la durée sans « Taille réelle des images » pour comparer.

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
