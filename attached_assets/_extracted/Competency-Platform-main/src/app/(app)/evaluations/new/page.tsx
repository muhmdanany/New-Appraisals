"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EvaluationForm } from "../evaluation-form";

export default function NewEvaluationPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [started, setStarted] = useState(false);
  const employees = api.employee.list.useQuery({ take: 500, skip: 0 });

  if (started && employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">تقييم جديد</h1>
        <EvaluationForm employeeId={employeeId} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">تقييم جديد</h1>
      <Card className="max-w-md space-y-4 p-5">
        <div className="space-y-1.5">
          <Label>اختر الموظف</Label>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">— اختر —</option>
            {employees.data?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeNumber})
              </option>
            ))}
          </Select>
          {employees.data && employees.data.length === 0 && (
            <p className="text-xs text-muted-foreground">لا يوجد موظفون ضمن نطاقك للتقييم.</p>
          )}
        </div>
        <Button disabled={!employeeId} onClick={() => setStarted(true)}>
          بدء التقييم
        </Button>
      </Card>
    </div>
  );
}
