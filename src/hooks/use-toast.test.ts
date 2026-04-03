import { describe, it, expect } from "vitest";

describe("use-toast reducer", () => {
  const reducer = (state: any, action: any): any => {
    switch (action.type) {
      case "ADD_TOAST":
        return {
          ...state,
          toasts: [action.toast, ...state.toasts].slice(0, 1),
        }

      case "UPDATE_TOAST":
        return {
          ...state,
          toasts: state.toasts.map((t: any) =>
            t.id === action.toast.id ? { ...t, ...action.toast } : t
          ),
        }

      case "DISMISS_TOAST": {
        const { toastId } = action

        return {
          ...state,
          toasts: state.toasts.map((t: any) =>
            t.id === toastId || toastId === undefined
              ? {
                ...t,
                open: false,
              }
              : t
          ),
        }
      }
      case "REMOVE_TOAST":
        if (action.toastId === undefined) {
          return {
            ...state,
            toasts: [],
          }
        }
        return {
          ...state,
          toasts: state.toasts.filter((t: any) => t.id !== action.toastId),
        }
      default:
        return state;
    }
  }

  it("should add a toast", () => {
    const initialState = { toasts: [] };
    const toast = { id: "1", title: "Test", open: true };
    const action = { type: "ADD_TOAST", toast };
    const newState = reducer(initialState, action);
    expect(newState.toasts).toHaveLength(1);
    expect(newState.toasts[0]).toEqual(toast);
  });

  it("should dismiss a specific toast", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "Test 1", open: true },
        { id: "2", title: "Test 2", open: true },
      ],
    };
    const action = { type: "DISMISS_TOAST", toastId: "1" };
    const newState = reducer(initialState, action);
    expect(newState.toasts.find((t: any) => t.id === "1")?.open).toBe(false);
    expect(newState.toasts.find((t: any) => t.id === "2")?.open).toBe(true);
  });

  it("should dismiss all toasts when toastId is not provided", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "Test 1", open: true },
        { id: "2", title: "Test 2", open: true },
      ],
    };
    const action = { type: "DISMISS_TOAST" };
    const newState = reducer(initialState, action);
    expect(newState.toasts.every((t: any) => !t.open)).toBe(true);
  });
});
