import { LoginForm } from "@/app/login/login-form";
import { LoginScreen } from "@/components/login-screen";

export default function PreviewLogin() {
  return <LoginScreen form={<LoginForm />} />;
}
