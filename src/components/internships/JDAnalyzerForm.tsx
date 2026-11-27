"use client";

import { AlertTriangle, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const MAX_RAW_JD_CHARS = 15_000;

type AnalyzeMode = "raw_jd" | "manual_skills" | "role_industry";

type AnalyzeApiSuccess = {
  ok: true;
  internshipId: string;
};

type AnalyzeApiError = {
  error?: string;
  code?: string;
};

export function JDAnalyzerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AnalyzeMode>("raw_jd");
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [manualSkillsText, setManualSkillsText] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRawTooLong = mode === "raw_jd" && rawInput.length > MAX_RAW_JD_CHARS;

  function buildPayload() {
    const trimmedTitle = title.trim();
    const trimmedCompany = companyName.trim();
    const trimmedIndustry = industry.trim();

    if (mode === "raw_jd") {
      return {
        mode: "raw_jd" as const,
        title: trimmedTitle,
        company_name: trimmedCompany,
        industry: trimmedIndustry,
        raw_input: rawInput.trim(),
      };
    }

    if (mode === "manual_skills") {
      const skills = manualSkillsText
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      return {
        mode: "manual_skills" as const,
        title: trimmedTitle,
        company_name: trimmedCompany,
        industry: trimmedIndustry,
        skills,
      };
    }

    return {
      mode: "role_industry" as const,
      title: trimmedTitle,
      company_name: trimmedCompany,
      role: role.trim(),
      industry: trimmedIndustry,
    };
  }

  async function runAnalyze() {
    if (isRawTooLong) {
      setErrorMessage("Teks JD melebihi batas maksimum 15.000 karakter.");
      return;
    }

    const payload = buildPayload();
    if (!payload.title) {
      setErrorMessage("Judul lowongan wajib diisi.");
      return;
    }
    if (payload.mode === "raw_jd" && !payload.raw_input) {
      setErrorMessage("Teks Job Description wajib diisi.");
      return;
    }
    if (payload.mode === "manual_skills" && payload.skills.length === 0) {
      setErrorMessage("Masukkan minimal 1 skill target.");
      return;
    }
    if (
      payload.mode === "role_industry" &&
      (!payload.role || !payload.industry)
    ) {
      setErrorMessage("Peran dan sektor industri wajib diisi.");
      return;
    }

    setSubmitting(true);
    setRateLimited(false);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/internships/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as
        | AnalyzeApiSuccess
        | AnalyzeApiError;

      if (!response.ok) {
        const errData = data as AnalyzeApiError;
        setRateLimited(
          response.status === 429 || errData.code === "RATE_LIMIT",
        );
        setErrorMessage(
          errData.error ?? "Gagal menganalisis lowongan magang.",
        );
        return;
      }

      const successData = data as AnalyzeApiSuccess;
      setOpen(false);
      router.push(`/internships/${successData.internshipId}`);
      router.refresh();
    } catch {
      setErrorMessage("Gagal terhubung ke server analisis.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAnalyze();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
          setRateLimited(false);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-4" />
        <span>Analisis Lowongan Baru</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Analisis Target Magang</DialogTitle>
          <DialogDescription>
            Ekstrak hard engineering skills, must-have vs nice-to-have, serta
            glosarium istilah industri tanpa memicu Hybrid Sourcing berlebih.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {rateLimited ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void runAnalyze()}
                  className="gap-1 bg-background text-foreground"
                >
                  <RefreshCw className="size-3" />
                  <span>Coba Analisis Ulang</span>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="jd-title" className="text-xs font-medium">
                Judul Posisi Magang
              </label>
              <Input
                id="jd-title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: Backend Engineering Intern"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="jd-company" className="text-xs font-medium">
                Perusahaan (opsional)
              </label>
              <Input
                id="jd-company"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Contoh: Acme Fintech"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="jd-industry" className="text-xs font-medium">
                Sektor Industri{" "}
                {mode === "role_industry" ? "(wajib)" : "(opsional)"}
              </label>
              <Input
                id="jd-industry"
                required={mode === "role_industry"}
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="Contoh: Fintech / E-Commerce / SaaS"
              />
            </div>
          </div>

          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (
                value === "raw_jd" ||
                value === "manual_skills" ||
                value === "role_industry"
              ) {
                setMode(value);
                setErrorMessage(null);
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="raw_jd">Teks JD Utuh</TabsTrigger>
              <TabsTrigger value="manual_skills">Daftar Skill</TabsTrigger>
              <TabsTrigger value="role_industry">Role &amp; Industri</TabsTrigger>
            </TabsList>

            <TabsContent value="raw_jd" className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="jd-raw-input" className="font-medium">
                  Tempel Job Description
                </label>
                <span
                  className={
                    isRawTooLong
                      ? "font-mono font-semibold tabular-nums text-destructive"
                      : "font-mono tabular-nums text-muted-foreground"
                  }
                >
                  {rawInput.length.toLocaleString("id-ID")} /{" "}
                  {MAX_RAW_JD_CHARS.toLocaleString("id-ID")} karakter
                </span>
              </div>
              <Textarea
                id="jd-raw-input"
                rows={7}
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder="Tempel kualifikasi & tanggung jawab lowongan di sini (maks. 15.000 karakter)..."
                className="max-h-60 font-mono text-xs"
              />
            </TabsContent>

            <TabsContent value="manual_skills" className="mt-3 space-y-1.5">
              <label
                htmlFor="jd-manual-skills"
                className="text-xs font-medium"
              >
                Daftar Skill Target (pisahkan dengan koma atau baris baru)
              </label>
              <Textarea
                id="jd-manual-skills"
                rows={5}
                value={manualSkillsText}
                onChange={(event) => setManualSkillsText(event.target.value)}
                placeholder="TypeScript, Next.js, PostgreSQL, Docker, REST API"
                className="font-mono text-xs"
              />
            </TabsContent>

            <TabsContent value="role_industry" className="mt-3 space-y-1.5">
              <label htmlFor="jd-role" className="text-xs font-medium">
                Peran Engineering Target
              </label>
              <Input
                id="jd-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Contoh: Backend Engineer / Platform Engineer / ML Engineer"
              />
              <p className="text-[11px] text-muted-foreground">
                AI akan menyusun kebutuhan skill standar dan glosarium untuk
                peran &amp; industri yang dipilih.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || isRawTooLong}
              className="gap-1.5"
            >
              <Sparkles className="size-4" />
              <span>
                {submitting ? "Menganalisis JD..." : "Analisis & Simpan Target"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
