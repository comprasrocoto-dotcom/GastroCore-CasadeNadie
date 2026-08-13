import { redirect } from 'next/navigation';

/** v9.8 — La portada de la aplicación ES el manual. */
export default function Home() {
  redirect('/manual');
}
