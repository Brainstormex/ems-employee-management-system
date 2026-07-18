"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, FileUp, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { importEmployeesCsv, EmployeeImportResult } from "@/lib/employees-api";
import { ApiError } from "@/lib/api";
import { Role } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: (f: File) => importEmployeesCsv(f),
    onSuccess: (res) => {
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      const { successCount, failedCount } = res.data;
      if (successCount > 0 && failedCount === 0) {
        toast.success(`Imported ${successCount} employee${successCount === 1 ? "" : "s"}`);
      } else if (successCount > 0) {
        toast.warning(
          `Imported ${successCount}; ${failedCount} row${failedCount === 1 ? "" : "s"} failed`
        );
      } else {
        toast.error("No rows imported — see failures below");
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Import failed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/employees"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import employees</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV to create multiple employees. Valid rows are saved; failed
          rows are reported without aborting the batch.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV format</CardTitle>
          <CardDescription>
            Required columns:{" "}
            <code className="text-xs">fullName, email, phone, department, designation, salary, joiningDate</code>
            . Optional:{" "}
            <code className="text-xs">status, role, reportingManagerCode, password, departmentId</code>
            . Phone must be E.164. Department is matched by name (e.g. Engineering).
            Default password if omitted: <code className="text-xs">ChangeMe@123</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a
            href="/samples/employees-import.csv"
            download
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <Download className="size-4" />
            Download sample CSV
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload file</CardTitle>
          <CardDescription>Max 500 rows · 2 MB · .csv only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setResult(null);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Choose CSV
            </Button>
            <span className="text-sm text-muted-foreground">
              {file ? file.name : "No file selected"}
            </span>
          </div>
          <Button
            type="button"
            disabled={!file || mutation.isPending}
            className="gap-1.5"
            onClick={() => file && mutation.mutate(file)}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {mutation.isPending ? "Importing…" : "Import"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import summary</CardTitle>
            <CardDescription>
              {result.successCount} succeeded · {result.failedCount} failed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.created.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Created</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.created.map((emp) => (
                    <li key={emp.id}>
                      <Link
                        href={`/employees/${emp.id}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {emp.fullName}
                      </Link>{" "}
                      ({emp.employeeCode} · {emp.email})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.failedRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Row</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.failedRows.map((fail) => (
                      <TableRow key={fail.row}>
                        <TableCell className="font-mono text-xs">
                          {fail.row}
                        </TableCell>
                        <TableCell className="text-sm">
                          {Object.entries(fail.errors)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function EmployeesImportPage() {
  return (
    <ProtectedRoute roles={[Role.SUPER_ADMIN, Role.HR_MANAGER]}>
      <ImportForm />
    </ProtectedRoute>
  );
}
