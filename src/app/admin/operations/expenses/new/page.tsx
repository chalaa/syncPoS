import { redirect } from "next/navigation";

export default function NewExpensePageRedirect() {
  redirect("/admin/operations/expenses");
}
