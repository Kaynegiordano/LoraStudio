# 1.4.0 — VRAM estimée avant de lancer, vérification des images, Merge économe

- **VRAM estimée avant de lancer** : la carte d'entraînement indique la mémoire nécessaire et celle disponible, et suit les réglages en direct. Quand elle ne suffira pas, des boutons proposent de corriger (décocher « Taille réelle », passer en 768 px, une seule résolution), et le lancement demande confirmation. L'estimation part de valeurs prudentes, puis du pic réellement mesuré lors de votre dernier entraînement.
- **Vérifier les images** (carte Projet) : doublons, images trop petites ou très allongées, filigranes et signatures repérés dans les légendes, fichiers illisibles. Un doublon ou une image trop petite se retire d'un clic.
- **Merge économe en mémoire** : les checkpoints sont lus et écrits couche par couche. Mémoire réservée mesurée sur ANIMA : 16,4 → 2,8 Go pour deux checkpoints, 8,9 → 1,7 Go pour le tout-en-un. Résultats identiques au bit près.
- **Corrigé** : les boîtes de confirmation ne s'ouvraient pas (supprimer un projet, retirer une image, arrêter et relancer).

# 1.3.0 — relecture complète : corrections et confort

- **Légendes enregistrées toutes seules** après une correction à la main : plus de légende perdue en changeant de projet ou en lançant l'entraînement sans cliquer « Enregistrer ».
- **Images d'aperçu agrandies d'un clic** (Échap ou clic pour refermer).
- **Fermeture** : si la file d'attente ou l'extinction du PC dépendent de la fenêtre, Lora Studio demande avant de fermer. L'entraînement lui-même continue sans la fenêtre.
- **Merge pendant un entraînement** : avertissement avant de lancer, les deux se partagent la carte graphique. Une fusion en cours s'arrête quand on quitte l'application.
- **Fenêtre** : taille et position retenues ; la version s'affiche au survol du nom.
- **« Modèle chargé » corrigé** : l'en-tête comptait toute la mémoire de la carte, si bien qu'un entraînement en cours faisait croire que KaneApp gardait un modèle chargé.
- **Suivi de l'entraînement en français** (pas, temps écoulé, reste, perte) ; il renonce après 30 s sans réponse et le dit, au lieu d'interroger sans fin.
- Un projet supprimé quitte la file d'attente ; textes qui parlaient encore de KaneApp ou d'anglais corrigés ; code hérité de KaneApp retiré.

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
