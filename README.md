# YourFellow Performance

AI-powered marketing platform voor het YourFellow team.

![YourFellow](https://via.placeholder.com/800x400/00FFCC/000000?text=YourFellow+Performance)

## 🚀 Features

- **Google Ads**
  - Ad teksten generator (headlines & descriptions)
  - Feed management & optimalisatie
  - Image generation voor Display & PMax

- **Social Media**
  - Post generator voor alle platforms
  - AI image creation

- **SEO**
  - Content schrijven
  - Title & Meta description generator

- **CRO**
  - URL Analyzer met Cialdini principes
  - Landingspagina optimalisatie advies

## 📋 Prerequisites

- Node.js 18+
- npm of yarn
- Supabase account
- Anthropic API key

## 🛠️ Setup

### 1. Clone de repository

\`\`\`bash
git clone https://github.com/yourfellow/performance.git
cd performance
\`\`\`

### 2. Installeer dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Configureer environment variables

Kopieer het voorbeeld bestand:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Vul de volgende variabelen in:

\`\`\`env
# Supabase (https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Anthropic (https://console.anthropic.com/settings/keys)
ANTHROPIC_API_KEY=sk-ant-api03-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### 4. Setup Supabase Database

Voer de volgende SQL uit in je Supabase SQL Editor:

\`\`\`sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'marketer' CHECK (role IN ('admin', 'marketer', 'client')),
  xp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE,
  tool TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own usage" ON public.usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON public.usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
\`\`\`

### 5. Start development server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment

### Vercel (Aanbevolen)

1. Push code naar GitHub
2. Importeer project in Vercel
3. Voeg environment variables toe
4. Deploy!

### DNS Setup voor performance.yourfellow.nl

Voeg een CNAME record toe:

\`\`\`
Type: CNAME
Name: performance
Value: cname.vercel-dns.com
\`\`\`

## 📁 Project Structuur

\`\`\`
src/
├── app/
│   ├── (auth)/           # Login, register pages
│   ├── (dashboard)/      # Main app pages
│   │   ├── dashboard/
│   │   ├── google-ads/
│   │   ├── social/
│   │   ├── seo/
│   │   └── cro/
│   └── api/              # API routes
├── components/
│   ├── ui/               # Reusable UI components
│   ├── sidebar.tsx
│   ├── header.tsx
│   └── logo.tsx
├── lib/
│   ├── supabase/         # Supabase client utilities
│   └── utils.ts
└── types/
    └── index.ts
\`\`\`

## 🎨 Brand Colors

- **Primary (Cyaan):** `#00FFCC`
- **Surface Dark:** `#171717`
- **Surface Light:** `#FAFAFA`

## 📝 License

Private - YourFellow © 2024
