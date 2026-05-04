import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
    isAuthenticated: boolean;
    user: any;
    access_token: string | null;
    refresh_token: string | null;
}

const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
    access_token: null,
    refresh_token: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        updateAuthState: (state, action: PayloadAction<{
            user: any;
            access_token: string;
            refresh_token: string;
        }>) => {
            state.isAuthenticated = true;   // ⭐ THIS IS THE KEY
            state.user = action.payload.user;
            state.access_token = action.payload.access_token;
            state.refresh_token = action.payload.refresh_token;
        },

        logout: (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.access_token = null;
            state.refresh_token = null;
        }
    }
});

export const { updateAuthState, logout } = authSlice.actions;
export default authSlice.reducer;