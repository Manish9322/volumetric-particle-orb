import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const SITE_TITLE = 'Volumetric Particle Orb';
const SITE_DESCRIPTION =
  'Interactive 3D three-layer monochrome volumetric particle sphere built with Next.js, TypeScript, Three.js, React Three Fiber, and custom GLSL shaders.';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  authors: [{ name: 'Manish Sonawane' }],
  creator: 'Manish Sonawane',
  keywords: [
    'Volumetric Particle Orb',
    'Three.js',
    'React Three Fiber',
    'GLSL Shaders',
    '3D Particle Sphere',
    'WebGL',
    'Next.js',
    'TypeScript',
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} bg-black`}
    >
      <body suppressHydrationWarning className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
