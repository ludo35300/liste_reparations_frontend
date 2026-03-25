
export const loginConfig = {
    title: 'Bienvenue',
    subtitle1: 'Identifiez vous',
    subtitle2: 'pour continuer',

    background: {
        type: 'gradient', // 'gradient' | 'image'
        gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        imageUrl: '/assets/login-bg.jpg',
    },

    button: { text: 'Connexion', },
    validation: {
        errors: {
            emailRequired: 'Email requis.',
            invalidEmail: 'Email invalide.',
            passwordTooShort: 'Mot de passe min 4 caractères.',
            authFailed: 'Erreur d\'authentification. Veuillez vérifier vos identifiants.',
        },
    },
};