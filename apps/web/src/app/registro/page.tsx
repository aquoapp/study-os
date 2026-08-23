import Link from 'next/link';

import { signUpAction } from '../actions/auth';
import { CredentialsForm } from '../_components/credentials-form';

export const metadata = { title: 'Crear cuenta · Study OS' };

export default function SignUpPage() {
  return (
    <div className="so-page">
      <h1>Crear cuenta</h1>
      <CredentialsForm
        action={signUpAction}
        submitLabel="Crear cuenta"
        passwordAutoComplete="new-password"
        testId="signup-form"
      />
      <p style={{ marginTop: 24 }}>
        ¿Ya tienes cuenta?{' '}
        <Link className="so-action" href="/entrar">
          Entrar
        </Link>
      </p>
    </div>
  );
}
