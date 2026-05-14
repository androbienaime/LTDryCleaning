// utils/customerStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import type { Customer } from '@/src/@types/models';

// ─── Helper : nom complet ─────────────────────────────────────────────────────

export function customerFullName(c: Customer): string {
  return [c.firstname, c.lastname].filter(Boolean).join(' ') || c.phone;
}

// ─── Clé AsyncStorage ─────────────────────────────────────────────────────────

const KEY = (accountId: string) => `@customers:${accountId}`;

function generateId(): string {
  return `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Stockage local des customers ────────────────────────────────────────────

export const CustomerStorage = {

  async getAll(accountId: string): Promise<Customer[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY(accountId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async save(accountId: string, customer: Customer): Promise<Customer> {
    const all   = await this.getAll(accountId);
    const saved: Customer = {
      ...customer,
      id:        customer.id        ?? generateId(),
      createdAt: customer.createdAt ?? Date.now(),
    };
    const idx = all.findIndex((c) => c.id === saved.id);
    if (idx >= 0) all[idx] = saved; else all.push(saved);
    await AsyncStorage.setItem(KEY(accountId), JSON.stringify(all));
    return saved;
  },

  async remove(accountId: string, customerId: string): Promise<void> {
    const all = (await this.getAll(accountId)).filter((c) => c.id !== customerId);
    await AsyncStorage.setItem(KEY(accountId), JSON.stringify(all));
  },
};

// ─── Contacts du téléphone ────────────────────────────────────────────────────

export const PhoneContacts = {

  async requestPermission(): Promise<boolean> {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  },

  async getAll(): Promise<Customer[]> {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return [];

    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.FirstName,
        Contacts.Fields.LastName,
        Contacts.Fields.MiddleName,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
      ],
    });

    return data
      .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map((c) => ({
        id:          `contact_${c.id}`,
        contactId:   c.id,
        name: c.firstName + ' ' + c.lastName,
        // expo-contacts expose firstName/lastName séparément
        firstname:   c.firstName  ?? c.name?.split(' ')[0]          ?? '',
        lastname:    c.lastName   ?? c.name?.split(' ').slice(-1)[0] ?? '',
        middle_name: c.middleName ?? undefined,
        phone:       c.phoneNumbers![0].number ?? '',
        email:       c.emails?.[0]?.email,
        savedToContacts: true,
      }));
  },

  async search(query: string): Promise<Customer[]> {
    const all = await this.getAll();
    const q   = query.toLowerCase();
    return all.filter(
      (c) =>
        c.firstname.toLowerCase().includes(q) ||
        c.lastname.toLowerCase().includes(q)  ||
        c.phone.includes(q)                   ||
        c.email?.toLowerCase().includes(q)
    );
  },

  // Enregistrer un customer dans les contacts du téléphone
  async saveToContacts(customer: Customer): Promise<string | null> {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return null;
    try {
      const contact: Contacts.Contact = {
        contactType:  Contacts.ContactTypes.Person,
        firstName:    customer.firstname,
        lastName:     customer.lastname,
        name:         customerFullName(customer),
        phoneNumbers: [{ number: customer.phone, label: 'mobile' }],
        emails:       customer.email
          ? [{ email: customer.email, label: 'work' }]
          : [],
      };
      return await Contacts.addContactAsync(contact) ?? null;
    } catch (e) {
      console.warn('[PhoneContacts] saveToContacts error:', e);
      return null;
    }
  },
};