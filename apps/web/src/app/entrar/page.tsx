import Link from 'next/link';

import { signInAction } from '../actions/auth';
import { CredentialsForm } from '../_components/credentials-form';

export const metadata = { title: 'Entrar · Study OS' };

export default function SignInPage() {
  return (
    <div className="so-page">
      <h1>Entrar</h1>
      <CredentialsForm
        action={signInAction}
        submitLabel="Entrar"
        passwordAutoComplete="current-password"
        testId="signin-form"
      />
      <p style={{ marginTop: 24 }}>
        ¿No tienes cuenta?{' '}
        <Link className="so-action" href="/registro">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
