"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { QuestionnaireAnswers } from "@/lib/types";

type QuestionnaireFormProps = {
  initialValues?: Partial<QuestionnaireAnswers>;
  loading?: boolean;
  onSubmit: (answers: QuestionnaireAnswers) => Promise<void> | void;
};

const AGE_RANGES = ["18-19", "20-22", "23-25", "26+"];
const CORE_VALUE_OPTIONS = [
  "成长",
  "真诚",
  "责任感",
  "自由",
  "稳定",
  "同理心",
  "家庭",
  "上进",
];
const HOBBY_OPTIONS = [
  "citywalk",
  "看展",
  "运动",
  "摄影",
  "音乐",
  "做饭",
  "阅读",
  "咖啡",
  "徒步",
  "桌游",
  "旅行",
];

const DEFAULT_VALUES: QuestionnaireAnswers = {
  displayName: "",
  ageRange: "20-22",
  major: "",
  coreValues: [],
  hobbies: [],
  weekendPlan: "citywalk",
  datePreference: "serious",
  communicationStyle: "balanced",
  futurePlan: "",
  relationshipValueScore: 4,
};

type MultiField = "coreValues" | "hobbies";

export default function QuestionnaireForm({
  initialValues,
  loading,
  onSubmit,
}: QuestionnaireFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuestionnaireAnswers>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    register("coreValues");
    register("hobbies");
  }, [register]);

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    reset({
      ...DEFAULT_VALUES,
      ...initialValues,
      coreValues: Array.isArray(initialValues.coreValues)
        ? initialValues.coreValues
        : [],
      hobbies: Array.isArray(initialValues.hobbies) ? initialValues.hobbies : [],
      relationshipValueScore:
        typeof initialValues.relationshipValueScore === "number"
          ? initialValues.relationshipValueScore
          : DEFAULT_VALUES.relationshipValueScore,
    });
  }, [initialValues, reset]);

  const toggleMultiChoice = (field: MultiField, option: string) => {
    const currentValues = watch(field) ?? [];
    const hasOption = currentValues.includes(option);
    const nextValues = hasOption
      ? currentValues.filter((item) => item !== option)
      : [...currentValues, option];

    setValue(field, nextValues, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const coreValues = watch("coreValues") ?? [];
  const hobbies = watch("hobbies") ?? [];
  const relationshipValueScore = watch("relationshipValueScore");

  return (
    <form
      className="space-y-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          relationshipValueScore: Number(values.relationshipValueScore),
        });
      })}
    >
      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-teal-700">Q1 / Q2 / Q3</p>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-800">1. 你的昵称（用于匹配展示）</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            placeholder="例如：小月"
            {...register("displayName", {
              required: "请填写昵称",
              minLength: { value: 2, message: "昵称至少 2 个字" },
            })}
          />
          {errors.displayName ? (
            <p className="text-xs text-rose-600">{errors.displayName.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-800">2. 你的年龄区间</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            {...register("ageRange", { required: true })}
          >
            {AGE_RANGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-800">3. 你的专业 / 研究方向</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            placeholder="例如：计算机科学"
            {...register("major", { required: "请填写专业信息" })}
          />
          {errors.major ? (
            <p className="text-xs text-rose-600">{errors.major.message}</p>
          ) : null}
        </label>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-teal-700">Q4</p>
        <p className="text-sm font-medium text-slate-800">4. 你最看重的核心价值观（可多选）</p>
        <div className="flex flex-wrap gap-2">
          {CORE_VALUE_OPTIONS.map((option) => {
            const selected = coreValues.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleMultiChoice("coreValues", option)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selected
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 text-slate-700 hover:border-teal-600 hover:text-teal-700"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-teal-700">Q5</p>
        <p className="text-sm font-medium text-slate-800">5. 你的兴趣爱好（可多选）</p>
        <div className="flex flex-wrap gap-2">
          {HOBBY_OPTIONS.map((option) => {
            const selected = hobbies.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleMultiChoice("hobbies", option)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:border-slate-700 hover:text-slate-900"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">6. 周末更常见的安排</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            {...register("weekendPlan", { required: true })}
          >
            <option value="citywalk">城市散步 / 咖啡探店</option>
            <option value="outdoor">户外运动 / 徒步骑行</option>
            <option value="learning">学习提升 / 作品项目</option>
            <option value="home">宅家休息 / 做饭追剧</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">7. 关系目标偏好</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            {...register("datePreference", { required: true })}
          >
            <option value="serious">认真长期关系</option>
            <option value="slow">先从朋友慢慢了解</option>
            <option value="open">轻松相处，保持开放</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">8. 沟通风格</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            {...register("communicationStyle", { required: true })}
          >
            <option value="fast">高频即时沟通</option>
            <option value="balanced">有节奏地稳定沟通</option>
            <option value="slow">偏慢但深入</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">9. 未来 3 年的规划关键词</span>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
            placeholder="例如：读研、留在长沙、创业、考公..."
            {...register("futurePlan", {
              required: "请填写未来规划",
              minLength: { value: 8, message: "建议至少 8 个字" },
            })}
          />
          {errors.futurePlan ? (
            <p className="text-xs text-rose-600">{errors.futurePlan.message}</p>
          ) : null}
        </label>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-teal-700">Q10</p>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-800">
            10. 你对长期关系投入意愿评分（1-7 分）
          </span>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            className="w-full accent-teal-700"
            {...register("relationshipValueScore", {
              valueAsNumber: true,
              min: 1,
              max: 7,
            })}
          />
          <p className="text-sm text-slate-600">当前分值：{relationshipValueScore ?? 4}</p>
        </label>
      </section>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      >
        {loading ? "提交中..." : "保存问卷并进入本周匹配"}
      </button>
    </form>
  );
}
