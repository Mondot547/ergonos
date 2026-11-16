"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <h1>Un problème est survenu</h1>
      <p>Veuillez réessayer. Si le problème persiste, contactez-nous.</p>
      <button className="btn" onClick={reset}>Réessayer</button>
    </>
  );
}
