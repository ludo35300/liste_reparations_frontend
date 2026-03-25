export const resetPasswordConfig = {
    subtitle1: 'Choisissez',
    subtitle2: 'un nouveau mot de passe',
    description: 'Saisissez votre nouveau mot de passe',
    description2: 'puis confirmez-le.',

    button: { text: 'Mettre à jour le mot de passe' },

    validation: {
        errors: {
        passwordTooShort: 'Mot de passe min 8 caractères.',
        passwordsMismatch: 'Les mots de passe ne correspondent pas.',
        invalidLink: 'Lien invalide ou expiré.',
        },
        success: 'Votre mot de passe a été mis à jour. Vous pouvez vous connecter.',
    },
};