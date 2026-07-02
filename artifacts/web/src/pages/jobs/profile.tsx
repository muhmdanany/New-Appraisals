import { useParams } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useGetJob, getGetJobQueryKey, useJobProfile, getJobProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobProfile() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: job, isLoading: jobLoading } = useGetJob(id!, { query: { enabled: !!id, queryKey: getGetJobQueryKey(id!) } });
  const { data: profile, isLoading: profileLoading } = useJobProfile(id!, { query: { enabled: !!id, queryKey: getJobProfileQueryKey(id!) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("jobs.profile.title")} {job?.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("jobs.profile.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><strong>{t("jobs.department")}:</strong> {job?.departmentName}</div>
              <div><strong>{t("jobs.grade")}:</strong> {job?.gradeName}</div>
              <div><strong>{t("jobs.contractType")}:</strong> {job?.contractType}</div>
              <div><strong>{t("jobs.expLevel")}:</strong> {job?.experienceLevel}</div>
              <div className="col-span-2"><strong>{t("jobs.description")}:</strong> {job?.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("jobs.requiredCompetencies")}</CardTitle>
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