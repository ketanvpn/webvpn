import {
  useMutation,
  useQueryClient,
  type InvalidateQueryFilters,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/utils";

/**
 * Wrapper around TanStack `useMutation` that standardises:
 *  - error toast (variant: "destructive")
 *  - optional success toast
 *  - optional auto-invalidation of query keys
 *
 * Usage:
 * ```ts
 * const save = useApiMutation({
 *   mutationFn: (data) => apiClient.post("/admin/vouchers", data),
 *   successMessage: "Voucher dibuat",
 *   invalidateKeys: [["admin-vouchers"]],
 * });
 * ```
 */

type ApiMutationOptions<
  TData = unknown,
  TVariables = void,
  TOnMutateResult = unknown,
> = Omit<
  UseMutationOptions<TData, Error, TVariables, TOnMutateResult>,
  "onError" | "onSuccess"
> & {
  errorTitle?: string;
  successMessage?: string;
  invalidateKeys?: InvalidateQueryFilters["queryKey"][];
  onSuccess?: UseMutationOptions<TData, Error, TVariables, TOnMutateResult>["onSuccess"];
  onError?: UseMutationOptions<TData, Error, TVariables, TOnMutateResult>["onError"];
};

export function useApiMutation<
  TData = unknown,
  TVariables = void,
  TOnMutateResult = unknown,
>(options: ApiMutationOptions<TData, TVariables, TOnMutateResult>) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const {
    errorTitle = "Gagal",
    successMessage,
    invalidateKeys,
    onSuccess: extraOnSuccess,
    onError: extraOnError,
    ...mutationOptions
  } = options;

  return useMutation<TData, Error, TVariables, TOnMutateResult>({
    ...mutationOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (invalidateKeys) {
        for (const queryKey of invalidateKeys) {
          qc.invalidateQueries({ queryKey });
        }
      }
      if (successMessage) {
        toast({ title: successMessage });
      }
      extraOnSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast({
        title: errorTitle,
        description: getApiError(error),
        variant: "destructive",
      });
      extraOnError?.(error, variables, onMutateResult, context);
    },
  });
}
