export const forgotPasswordConfig = {
    subtitle1: 'Réinitialisez ',
    subtitle2: 'votre mot de passe',
    description: 'Entrez votre adresse email ',
    description2: 'pour recevoir un lien de réinitialisation.',

    background: {
        type: 'gradient', // 'gradient' | 'image'
        gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        imageUrl: '/assets/login-bg.jpg',
    },

    button: { text: 'Envoyer un code de réinitialisation', },
    validation: {
        errors: {
            emailRequired: 'Email requis.',
            invalidEmail: 'Email invalide.'
        },
        success: 'Un email de réinitialisation a été envoyé à votre adresse.'
    },
};