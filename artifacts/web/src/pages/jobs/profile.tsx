import { useParams } from "wouter";
import { useGetJob, getGetJobQueryKey, useJobProfile, getJobProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobProfile() {
  const { id } = useParams();
  const { data: job, isLoading: jobLoading } = useGetJob(id!, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id!) } });
  const { data: profile, isLoading: profileLoading } = useJobProfile(id!, { query: { enabled: !!id, queryKey: getJobProfileQueryKey(id!) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الملف الوظيفي: {job?.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل الوظيفة</CardTitle>
        </CardHeader>
        <CardContent>
          {jobLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><strong>الإدارة:</strong> {job?.departmentName}</div>
              <div><strong>الدرجة:</strong> {job?.gradeName}</div>
              <div><strong>نوع العقد:</strong> {job?.contractType}</div>
              <div><strong>مستوى الخبرة:</strong> {job?.experienceLevel}</div>
              <div className="col-span-2"><strong>الوصف:</strong> {job?.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الجدارات المرتبطة</CardTitle>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="list-disc list-inside px-4">
              {profile?.competencies?.map((comp) => (
                <li key={comp.id}>{comp.name} - {comp.level}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}