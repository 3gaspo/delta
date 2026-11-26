import { AuthForm } from '../components/AuthForm';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../providers/AuthProvider';
export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  return <AuthShell appName="Delta" logo="/delta.svg">
    <AuthForm onResetPassword={resetPassword} onAuthenticate={(email, password, signUpMode) => signUpMode ? signUp(email, password) : signIn(email, password)} />
  </AuthShell>;
}
