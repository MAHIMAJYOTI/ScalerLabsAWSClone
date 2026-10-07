"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { useLogin, useMe } from "@/lib/api/hooks/auth";
import { useBackendWarmup } from "@/lib/hooks/useBackendWarmup";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "route53demo";
const HOME = "/route53/v2/hostedzones";

export function LoginForm() {
  const router = useRouter();
  const me = useMe();
  const login = useLogin();
  const warmup = useBackendWarmup();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already signed in → straight to the console.
  useEffect(() => {
    if (me.data) router.replace(HOME);
  }, [me.data, router]);

  const submit = () => {
    setError(null);
    login.mutate(
      { username, password },
      {
        onSuccess: () => router.replace(HOME),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) {
            setError("Invalid username or password.");
          } else {
            setError(
              err instanceof Error ? err.message : "Sign-in failed. Try again.",
            );
          }
        },
      },
    );
  };

  return (
    <div className="r53-login">
      <div className="r53-login-card">
        <Container
          header={<Header variant="h1">Sign in to Route 53 Clone</Header>}
        >
          <SpaceBetween size="l">
            <Alert type="info">
              Demo application. Not affiliated with AWS. Use the demo
              credentials below; do not enter real AWS credentials.
            </Alert>
            {warmup.state === "connecting" && (
              <StatusIndicator type="loading">
                Connecting to server… this can take up to a minute on first
                load
              </StatusIndicator>
            )}
            {warmup.state === "failed" && (
              <Alert
                type="error"
                header="Couldn't reach the server"
                action={<Button onClick={warmup.retry}>Retry</Button>}
              >
                The backend didn&apos;t respond within 90 seconds. It may still
                be starting up — try again.
              </Alert>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Form
                errorText={error}
                actions={
                  <Button
                    variant="primary"
                    loading={login.isPending}
                    disabled={warmup.state !== "ready"}
                    formAction="submit"
                  >
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="m">
                  <FormField label="Username" stretch>
                    <Input
                      value={username}
                      onChange={({ detail }) => setUsername(detail.value)}
                      autoFocus
                      autoComplete="username"
                      placeholder="demo"
                    />
                  </FormField>
                  <FormField label="Password" stretch>
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      autoComplete="current-password"
                    />
                  </FormField>
                  <Box fontSize="body-s" color="text-body-secondary">
                    Demo credentials: <strong>{DEMO_USERNAME}</strong> /{" "}
                    <strong>{DEMO_PASSWORD}</strong> —{" "}
                    <Link
                      onFollow={(event) => {
                        event.preventDefault();
                        setUsername(DEMO_USERNAME);
                        setPassword(DEMO_PASSWORD);
                      }}
                    >
                      Use demo credentials
                    </Link>
                  </Box>
                </SpaceBetween>
              </Form>
            </form>
          </SpaceBetween>
        </Container>
      </div>
    </div>
  );
}
