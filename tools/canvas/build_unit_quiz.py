#!/usr/bin/env python3
"""Build one unit's Canvas Classic Quiz (QTI 1.2, laid out like a Canvas .imscc export) from questions.json.

usage: python3 tools/canvas/build_unit_quiz.py canvas-quizzes/g5-sci-u03
Writes, in that folder:
  <quiz-id>/assessment_meta.xml           quiz settings + its assignment
  non_cc_assessments/<quiz-id>.xml.qti    the questions
  manifest-resource.xml                   the <resource> entries to paste into imsmanifest.xml
  <folder-name>-quiz-key.html             a print-friendly answer key for the teacher
Question types in questions.json: mc (opts + ans index), tf (ans true/false), match (pairs + extra right-side options).
Held for the course .imscc (Bethany, Nov 2026): never add it to a course package until she says so.
"""
import html, json, os, sys
from xml.sax.saxutils import escape as x

def build(folder):
    Q = json.load(open(os.path.join(folder, 'questions.json'), encoding='utf-8'))
    qid, title, items = Q['id'], Q['title'], Q['questions']
    pts = float(len(items))
    os.makedirs(os.path.join(folder, qid), exist_ok=True)
    os.makedirs(os.path.join(folder, 'non_cc_assessments'), exist_ok=True)
    group = 'g5sci_group_summative'
    meta = f'''<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="{qid}" xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
  <title>{x(title)}</title>
  <description>{x('<p>' + Q['description'] + '</p>')}</description>
  <shuffle_answers>true</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <hide_results></hide_results>
  <quiz_type>assignment</quiz_type>
  <points_possible>{pts}</points_possible>
  <require_lockdown_browser>false</require_lockdown_browser>
  <require_lockdown_browser_for_results>false</require_lockdown_browser_for_results>
  <require_lockdown_browser_monitor>false</require_lockdown_browser_monitor>
  <lockdown_browser_monitor_data/>
  <show_correct_answers>true</show_correct_answers>
  <anonymous_submissions>false</anonymous_submissions>
  <could_be_locked>false</could_be_locked>
  <allowed_attempts>1</allowed_attempts>
  <one_question_at_a_time>false</one_question_at_a_time>
  <cant_go_back>false</cant_go_back>
  <available>false</available>
  <one_time_results>false</one_time_results>
  <show_correct_answers_last_attempt>false</show_correct_answers_last_attempt>
  <only_visible_to_overrides>false</only_visible_to_overrides>
  <module_locked>false</module_locked>
  <assignment identifier="{qid}_assignment">
    <title>{x(title)}</title>
    <due_at/>
    <lock_at/>
    <unlock_at/>
    <module_locked>false</module_locked>
    <workflow_state>unpublished</workflow_state>
    <assignment_overrides>
    </assignment_overrides>
    <quiz_identifierref>{qid}</quiz_identifierref>
    <allowed_extensions></allowed_extensions>
    <has_group_category>false</has_group_category>
    <points_possible>{pts}</points_possible>
    <grading_type>points</grading_type>
    <all_day>false</all_day>
    <submission_types>online_quiz</submission_types>
    <position>{Q['unit']}</position>
    <turnitin_enabled>false</turnitin_enabled>
    <vericite_enabled>false</vericite_enabled>
    <peer_review_count>0</peer_review_count>
    <peer_reviews>false</peer_reviews>
    <automatic_peer_reviews>false</automatic_peer_reviews>
    <anonymous_peer_reviews>false</anonymous_peer_reviews>
    <grade_group_students_individually>false</grade_group_students_individually>
    <freeze_on_copy>false</freeze_on_copy>
    <omit_from_final_grade>false</omit_from_final_grade>
    <intra_group_peer_reviews>false</intra_group_peer_reviews>
    <only_visible_to_overrides>false</only_visible_to_overrides>
    <post_to_sis>false</post_to_sis>
    <moderated_grading>false</moderated_grading>
    <grader_count>0</grader_count>
    <grader_comments_visible_to_graders>true</grader_comments_visible_to_graders>
    <anonymous_grading>false</anonymous_grading>
    <graders_anonymous_to_graders>false</graders_anonymous_to_graders>
    <grader_names_visible_to_final_grader>true</grader_names_visible_to_final_grader>
    <anonymous_instructor_annotations>false</anonymous_instructor_annotations>
    <post_policy>
      <post_manually>false</post_manually>
    </post_policy>
    <assignment_group_identifierref>{group}</assignment_group_identifierref>
  </assignment>
  <assignment_group_identifierref>{group}</assignment_group_identifierref>
  <assignment_overrides>
  </assignment_overrides>
</quiz>
'''
    open(os.path.join(folder, qid, 'assessment_meta.xml'), 'w', encoding='utf-8').write(meta)

    def mat(t, kind='text/html'):
        return f'<material><mattext texttype="{kind}">{x(t)}</mattext></material>'
    def para(t):
        return t if t.lstrip().startswith('<') else '<p>' + html.escape(t) + '</p>'
    def meta_f(qtype, ids):
        return ('<itemmetadata><qtimetadata>'
                f'<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>{qtype}</fieldentry></qtimetadatafield>'
                '<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>1.0</fieldentry></qtimetadatafield>'
                f'<qtimetadatafield><fieldlabel>original_answer_ids</fieldlabel><fieldentry>{",".join(ids)}</fieldentry></qtimetadatafield>'
                '</qtimetadata></itemmetadata>')
    def fb(it, q):
        ok = f'<p>{html.escape(q["why"])}</p>'
        no = f'<p>Look back at lesson {html.escape(q["look"])}.</p>'
        gen = ok + no
        return (f'<itemfeedback ident="general_fb"><flow_mat>{mat(gen)}</flow_mat></itemfeedback>'
                f'<itemfeedback ident="correct_fb"><flow_mat>{mat(ok)}</flow_mat></itemfeedback>'
                f'<itemfeedback ident="general_incorrect_fb"><flow_mat>{mat(no)}</flow_mat></itemfeedback>')
    out = []
    for n, q in enumerate(items, 1):
        it = f'{qid}_q{n}'
        t = q['type']
        if t in ('mc', 'tf'):
            opts = q['opts'] if t == 'mc' else ['True', 'False']
            ans = q['ans'] if t == 'mc' else (0 if q['ans'] else 1)
            ids = [f'{it}_{chr(97 + i)}' for i in range(len(opts))]
            labels = ''.join(f'<response_label ident="{ids[i]}">{mat(o, "text/plain")}</response_label>' for i, o in enumerate(opts))
            body = (f'<presentation>{mat(para(q["q"]))}<response_lid ident="response1" rcardinality="Single"><render_choice>{labels}</render_choice></response_lid></presentation>'
                    '<resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>'
                    f'<respcondition continue="No"><conditionvar><varequal respident="response1">{ids[ans]}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar><displayfeedback feedbacktype="Response" linkrefid="correct_fb"/></respcondition>'
                    '<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_incorrect_fb"/></respcondition>'
                    '</resprocessing>')
            out.append(f'<item ident="{it}" title="Question {n}">{meta_f("multiple_choice_question" if t == "mc" else "true_false_question", ids)}{body}{fb(it, q)}</item>')
        elif t == 'match':
            lefts = [f'{it}_l{i + 1}' for i in range(len(q['pairs']))]
            rights = [p[1] for p in q['pairs']] + q.get('extra', [])
            rids = [f'{it}_r{i + 1}' for i in range(len(rights))]
            choice = ''.join(f'<response_label ident="{rids[i]}">{mat(r, "text/plain")}</response_label>' for i, r in enumerate(rights))
            lids = ''.join(f'<response_lid ident="response_{lefts[i]}">{mat(p[0], "text/plain")}<render_choice>{choice}</render_choice></response_lid>' for i, p in enumerate(q['pairs']))
            each = round(100.0 / len(lefts), 2)
            conds = ''.join(f'<respcondition><conditionvar><varequal respident="response_{lefts[i]}">{rids[i]}</varequal></conditionvar><setvar varname="SCORE" action="Add">{each}</setvar></respcondition>' for i in range(len(lefts)))
            body = (f'<presentation>{mat(para(q["q"]))}{lids}</presentation>'
                    '<resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>'
                    '<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>'
                    f'{conds}</resprocessing>')
            out.append(f'<item ident="{it}" title="Question {n}">{meta_f("matching_question", lefts)}{body}{fb(it, q)}</item>')
        else:
            sys.exit('unknown type ' + t)
    qti = ('<?xml version="1.0" encoding="UTF-8"?>\n<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">\n'
           f'<assessment ident="{qid}" title="{x(title)}"><qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>'
           '<section ident="root_section">\n' + '\n'.join(out) + '\n</section></assessment></questestinterop>\n')
    open(os.path.join(folder, 'non_cc_assessments', qid + '.xml.qti'), 'w', encoding='utf-8').write(qti)
    man = f'''<!-- Paste into <resources> of imsmanifest.xml when the course .imscc is built (held until Bethany says so).
     The course must also define the assignment group "{group}" ("{Q['group']}") in course_settings/assignment_groups.xml. -->
<resource identifier="{qid}" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment">
  <file href="{qid}/assessment_meta.xml"/>
  <file href="non_cc_assessments/{qid}.xml.qti"/>
  <dependency identifierref="{qid}_dep"/>
</resource>
<resource identifier="{qid}_dep" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="{qid}/assessment_meta.xml">
  <file href="{qid}/assessment_meta.xml"/>
  <file href="non_cc_assessments/{qid}.xml.qti"/>
</resource>
'''
    open(os.path.join(folder, 'manifest-resource.xml'), 'w', encoding='utf-8').write(man)
    # the key
    rows = []
    for n, q in enumerate(items, 1):
        if q['type'] == 'mc':
            opts = ''.join(f'<li class="{"ok" if i == q["ans"] else ""}">{q["opts"][i]}{" ✓" if i == q["ans"] else ""}</li>' for i in range(len(q['opts'])))
            ans = q['opts'][q['ans']]
            kind = 'Multiple choice'
        elif q['type'] == 'tf':
            opts = ''.join(f'<li class="{"ok" if v == q["ans"] else ""}">{"True" if v else "False"}{" ✓" if v == q["ans"] else ""}</li>' for v in (True, False))
            ans = 'True' if q['ans'] else 'False'; kind = 'True / false'
        else:
            opts = ''.join(f'<li class="ok">{html.escape(a)} → {html.escape(b)}</li>' for a, b in q['pairs']) + ''.join(f'<li>(extra choice, matches nothing) {html.escape(e)}</li>' for e in q.get('extra', []))
            ans = 'see the pairs'; kind = 'Matching'
        rows.append(f'<section class="q"><div class="h"><b>Question {n}</b> · {kind} · 1 point · <span class="src">From lesson {html.escape(q["from"])}</span></div><div class="qt">{para(q["q"])}</div><ol type="A">{opts}</ol><p class="fb"><b>Correct feedback:</b> {html.escape(q["why"])}<br><b>Wrong answer feedback:</b> Look back at lesson {html.escape(q["look"])}.</p></section>')
    page = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}: answer key</title>
<style>body{{font:15px/1.5 Georgia,serif;color:#2B1D12;max-width:860px;margin:24px auto;padding:0 18px}}h1{{font:800 24px Arial,sans-serif;color:#0E1C42;margin:0}}.sub{{font:13px Arial,sans-serif;color:#7a6a58;margin:4px 0 18px}}
.q{{border:1px solid #E2D6C8;border-radius:10px;padding:10px 14px;margin:10px 0;break-inside:avoid}}.h{{font:13px Arial,sans-serif;color:#5A4D3E}}.src{{color:#7a5a2c}}.qt p{{margin:6px 0}}table{{font:13px Arial,sans-serif;margin:6px 0}}
ol{{margin:6px 0 6px 22px}}li.ok{{font-weight:700;color:#1a6b35}}.fb{{font:13px Arial,sans-serif;color:#5A4D3E;margin:6px 0 0}}@media print{{body{{margin:0}}.q{{border-color:#999}}}}</style></head><body>
<h1>{html.escape(title)}</h1><div class="sub">Answer key · Grade 5 Science, Optima Academy Online · {len(items)} questions, 1 point each, auto-graded · lessons {", ".join(Q["lessons"])} · Canvas Classic Quiz {qid} (held for the course .imscc)</div>
{"".join(rows)}</body></html>'''
    name = os.path.basename(os.path.normpath(folder))
    open(os.path.join(folder, f'{name}-quiz-key.html'), 'w', encoding='utf-8').write(page)
    print('built', qid, len(items), 'questions')

if __name__ == '__main__':
    build(sys.argv[1])
