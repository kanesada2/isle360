import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const BASE_URL = __DEV__
    ? "http://localhost:5173"
    : "https://api.isle360.nosada.com";

export const authClient = createAuthClient({
    baseURL: BASE_URL,
    plugins: [
        expoClient({
            scheme: "isle360",
            storagePrefix: "isle360",
            storage: SecureStore,
        })
    ]
});