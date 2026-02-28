# Keriva - Encuentra tu Farmacia 💊

Una aplicación móvil para encontrar farmacias de turno cerca de ti. Reporta y descubre farmacias abiertas 24/7.

## Características

- 🗺️ Mapa interactivo con farmacias cercanas
- 📍 Geolocalización en tiempo real
- 📝 Reportar nuevas farmacias
- 📱 Responsive y optimizado para móviles
- 🌐 Funciona en web, iOS y Android

## Tech Stack

- **Framework:** Expo + React Native
- **Routing:** Expo Router (file-based)
- **Database:** Supabase
- **Maps:** React Native Maps
- **Fonts:** DM Sans + Poppins
- **Icons:** Lucide React Native

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Web

```bash
npm run build:web
```

## Project Structure

```
app/
├── (tabs)/           # Tab navigation screens
│   ├── index.tsx    # Home - Lista de farmacias
│   ├── map.tsx      # Mapa
│   ├── report.tsx   # Reportar farmacia
│   └── profile.tsx  # Perfil
├── _layout.tsx      # Root layout
└── detail.tsx       # Detalle de farmacia

lib/
├── supabase.ts      # Supabase client
├── translations.ts  # i18n support
└── LanguageContext.tsx

supabase/
└── migrations/      # Database migrations
```

## Database Schema

### Pharmacies Table

- `id`: UUID (Primary Key)
- `name`: Text
- `address`: Text
- `phone`: Text
- `latitude`: Numeric
- `longitude`: Numeric
- `is_24_7`: Boolean
- `is_on_duty`: Boolean
- `created_at`: Timestamp

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel.

**Quick Deploy:**

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

Your app will be live at: `https://your-app.vercel.app`

## Environment Variables

Create a `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Author

Alfredo Castro (@alfredocastrokeriva)

## License

Private - All rights reserved
