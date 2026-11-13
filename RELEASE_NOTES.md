# 1.0.0 — Lora Studio, l'atelier des LoRA à part

- **Entraînement** : l'atelier Lora de KaneApp, complet. On y retrouve projets, légendes, gestionnaire de tags, préréglage conseillé, file d'attente, cartes par époque et « Garder cette version ».
- **Merge** : LoRA + LoRA, checkpoints, LoRA → checkpoint, VAE + encodeur.
- Lora Studio utilise les moteurs de KaneApp (KaneAppData) et vos projets existants, sans rien copier.
- Il ne charge aucun checkpoint. Avant un entraînement, il libère la carte graphique en déchargeant le modèle du Studio de KaneApp, si celui-ci est démarré.
- « Essayer » envoie le LoRA et son déclencheur dans l'invite du Studio de KaneApp. Un double clic sur une image l'ouvre dans KaneApp.
