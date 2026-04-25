const BASE_URL = "http://localhost:8000/auth";

export const loginUser = async (data: {
  email: string;
  password: string;
  role: string;
}) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.detail || "Login failed");
  }

  return json;
};

export const signupUser = async (data: {
  email: string;
  password: string;
  full_name: string;
  role: string;
}) => {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.detail || "Signup failed");
  }

  return json;
};