import { AuthForm } from '../components/AuthForm';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../providers/AuthProvider';
export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  return <AuthShell appName="Delta" logo="/delta.svg"><AuthForm onAuthenticate={(email, password, signUpMode) => signUpMode ? signUp(email, password) : signIn(email, password)} /></AuthShell>;
}
