/* 业务不变量冒烟测试：esbuild 临时打包后用 node 执行，不进入产物 */
import assert from "node:assert";
import { buildSeed } from "../src/store/seed";
import {
  cabinetRegistry,
  claim,
  compareFields,
  locationCards,
  requestAmendment,
  reviewAmendment,
  saveDraft,
  submitDraft,
  submitReview,
  type ActionResult,
} from "../src/store/logic";
import type { DomainState, FieldData, Specimen } from "../src/types";

let state: DomainState = buildSeed();
const ok = (r: unknown): asserts r is DomainState => {
  const res = r as ActionResult;
  if ("ok" in res && res.ok === false) throw new Error(res.error);
};
const fail = (r: unknown) => {
  const res = r as ActionResult;
  assert.ok("ok" in res && res.ok === false, "预期操作被拒绝");
};
const byNo = (no: string) => state.specimens.find((s) => s.collectionNo === no)!;
const same: FieldData = {
  species: "色木槭 Acer mono",
  location: "浙江·天目山·三里亭",
  altitude: "海拔 640 m",
  collector: "周慧、林放",
  cabinet: "A-01-01",
};

// 1. 领取 → 转录（含一处错误）→ 提交：待复核期间柜位不预占
ok((state = claim(state, byNo("HX-20260918-01").id, "甲") as DomainState));
const wrong = { ...same, species: "色木槭（错）" };
ok((state = saveDraft(state, byNo("HX-20260918-01").id, "甲", wrong) as DomainState));
ok((state = submitDraft(state, byNo("HX-20260918-01").id, "甲") as DomainState));
assert.equal(cabinetRegistry(state).get("A-01-01")!.status, "free", "待复核时柜位必须仍空闲");

// 2. 复核人不能是录入人本人
fail(submitReview(state, byNo("HX-20260918-01").id, { reviewer: "甲", verdicts: compareFields(wrong, byNo("HX-20260918-01").label) }));

// 3. 任一字段不符即退回，旧稿保留，不发证
ok(
  (state = submitReview(state, byNo("HX-20260918-01").id, {
    reviewer: "乙",
    verdicts: compareFields(wrong, byNo("HX-20260918-01").label),
  }) as DomainState),
);
const returned = byNo("HX-20260918-01");
assert.equal(returned.status, "returned");
assert.equal(returned.accessionNo, undefined);
assert.deepEqual(returned.draft, wrong, "退回必须保留旧稿");

// 4. 改对后由他人复核通过：发证、锁定、柜位此刻才占用
ok((state = saveDraft(state, returned.id, "甲", same) as DomainState));
ok((state = submitDraft(state, returned.id, "甲") as DomainState));
ok(
  (state = submitReview(state, returned.id, {
    reviewer: "乙",
    verdicts: compareFields(same, returned.label),
  }) as DomainState),
);
const archived = byNo("HX-20260918-01");
assert.equal(archived.status, "archived");
assert.equal(archived.accessionNo, "HN-0004");
assert.equal(cabinetRegistry(state).get("A-01-01")!.status, "occupied");

// 5. 竞争情形：另一份待复核标本的纸签柜位也是 A-01-01（与已建档 HN-0004 撞柜）
//    —— 柜位只在通过瞬间登记，五字段一致也必须阻断发证，而不是先占
{
  const clashId = "test-clash";
  const clashLabel: FieldData = { ...byNo("HX-20260922-01").label, cabinet: "A-01-01" };
  state.specimens.push({
    id: clashId,
    collectionNo: "TEST-CLASH",
    label: clashLabel,
    status: "review",
    claimedBy: "宋岚",
    claimedAt: Date.now() - 1000,
    submittedAt: Date.now(),
    draft: { ...clashLabel },
    reviews: [],
    versions: [],
    amendments: [],
  });
  fail(
    submitReview(state, clashId, { reviewer: "林放", verdicts: compareFields(clashLabel, clashLabel) }),
  );
  assert.equal(byNo("TEST-CLASH").status, "review", "柜位被占用时阻断发证");
  assert.equal(cabinetRegistry(state).get("A-01-01")!.accessionNo, "HN-0004", "占用归属不变");
  state.specimens = state.specimens.filter((s) => s.id !== clashId);
  assert.equal(cabinetRegistry(state).get("B-02-04")!.status, "free", "未发证则纸签柜位也不登记");
}

// 6. 种子数据：柜位变更待复核期间，原柜不释放、新柜不预占
const moving = byNo("HX-20260920-02");
const reg = cabinetRegistry(state);
assert.equal(reg.get("C-03-06")!.status, "occupied", "原柜位审核期间不释放");
assert.equal(reg.get("C-03-06")!.movingOut, true);
assert.equal(reg.get("B-04-02")!.status, "incoming", "新柜位只挂拟调入，不预占");

// 7. 变更申请：缺原因拒绝；申请人不能自审
fail(requestAmendment(state, archived.id, "甲", { kind: "species", newValue: "色木槭 Acer mono Maxim.", reason: "" }));
ok((state = requestAmendment(state, archived.id, "甲", { kind: "species", newValue: "五角槭 Acer pictum", reason: "专家重新鉴定" }) as DomainState));
const am = byNo("HX-20260918-01").amendments.find((a) => a.status === "review")!;
fail(reviewAmendment(state, archived.id, am.id, { reviewer: "甲", approve: true }));
ok((state = reviewAmendment(state, archived.id, am.id, { reviewer: "丙", approve: true }) as DomainState));
assert.equal(byNo("HX-20260918-01").locked!.species, "五角槭 Acer pictum");
assert.equal(byNo("HX-20260918-01").versions.length, 2, "通过后生成新版本，旧版留存");

// 8. 柜位变更驳回：维持旧版与原柜位
const mvAm = moving.amendments.find((a) => a.status === "review")!;
ok((state = reviewAmendment(state, moving.id, mvAm.id, { reviewer: "丁", approve: false }) as DomainState));
assert.equal(byNo("HX-20260920-02").locked!.cabinet, "C-03-06");
assert.equal(cabinetRegistry(state).get("C-03-06")!.status, "occupied");
assert.equal(cabinetRegistry(state).get("B-04-02")!.status, "free");

// 9. 地点卡正常聚合
assert.ok(locationCards(state).some((c) => c.location.includes("天目山")));

console.log("ALL INVARIANTS PASSED");
