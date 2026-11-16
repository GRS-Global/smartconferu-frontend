"use client";

import { useMemo, useState } from "react";
import type { Profile, ProfilePatch } from "@/types/profile";
import { withPrimaryAffiliation, type InstitutionValue } from "./affiliations";
import type { PhotoValue } from "./components/photo-field";
import { getProfileCompleteness } from "./completeness";
import { initialsOf } from "./components/profile-avatar";
import { validateProfileForm, type FieldProblems, type FormValues } from "./validation";

export function photoValueOf(profile: Profile): PhotoValue {
  return profile.photoUrl ? { kind: "stored", url: profile.photoUrl, name: profile.photo } : { kind: "none" };
}

/** The form state shared by Complete Profile and My Profile › General: the identity details every account
 *  needs (name, affiliation, designation, country, gender) plus website, phone and photo. */
export function useIdentityForm(profile: Profile) {
  const [values, setValues] = useState({
    firstName: profile.firstName, lastName: profile.lastName, designation: profile.designation,
    country: profile.country, gender: profile.gender, webPage: profile.webPage, phone: profile.phone,
    notifyChannels: profile.notifyChannels,
  });
  const [inst, setInst] = useState<InstitutionValue>({ name: profile.affiliation, institutionId: profile.affiliationInstitutionId, pending: profile.affiliationPending });
  const [department, setDepartment] = useState(profile.affiliationDepartment);
  const [photo, setPhoto] = useState<PhotoValue>(() => photoValueOf(profile));
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const touch = (key: keyof FormValues) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  const formValues: FormValues = { ...values, mainEmail: profile.mainEmail, affiliation: inst.name };
  const problems: FieldProblems = useMemo(() => validateProfileForm(formValues), [formValues.firstName, formValues.lastName, formValues.mainEmail, formValues.affiliation, formValues.designation, formValues.country, formValues.gender, formValues.webPage, formValues.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  const errorOf = (key: keyof FormValues) => (touched[key] ? problems[key] : undefined);
  const touchAll = () => setTouched({ firstName: true, lastName: true, mainEmail: true, affiliation: true, designation: true, country: true, gender: true, webPage: true, phone: true });

  const completeness = getProfileCompleteness({ ...profile, ...values, affiliation: inst.name, photo: photo.kind === "none" ? "" : photo.name });
  const initials = initialsOf(values.firstName, values.lastName, profile.mainEmail);

  /** The patch to save, and the photo to upload first (if a new one was picked). */
  const buildPatch = (): { patch: ProfilePatch; newPhoto: Blob | null } => {
    const patch: ProfilePatch = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      designation: values.designation.trim(),
      country: values.country,
      gender: values.gender,
      webPage: values.webPage.trim(),
      phone: values.phone.trim(),
      notifyChannels: values.notifyChannels,
      ...withPrimaryAffiliation(profile, inst, department),
    };
    if (photo.kind === "none" && profile.photoUrl) patch.photoPath = null;
    return { patch, newPhoto: photo.kind === "new" ? photo.blob : null };
  };

  return { values, set, inst, setInst, department, setDepartment, photo, setPhoto, problems, errorOf, touch, touchAll, completeness, initials, buildPatch };
}

export type IdentityForm = ReturnType<typeof useIdentityForm>;
