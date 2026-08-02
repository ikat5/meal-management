import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * EXPENSE (one market trip)
 * ──────────────────────────
 * `items` is the dynamic list the user types in the form
 * ("Rice 450", "Oil 210", ...).
 *
 * `totalAmount` is NEVER accepted from the client. The pre-validate hook
 * below recomputes it from the items on every save, so the stored total
 * can't drift from the item list — whether by a UI bug or a crafted request.
 */
export interface IExpenseItem {
  name: string;
  price: number;
}

export interface IExpense {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  user: Types.ObjectId; // who did the shopping
  date: string; // "YYYY-MM-DD"
  items: IExpenseItem[];
  totalAmount: number; // auto-computed — see hook below
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    items: {
      type: [
        {
          name: { type: String, required: true, trim: true, maxlength: 100 },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      validate: {
        validator: (items: IExpenseItem[]) => items.length > 0,
        message: "An expense needs at least one item",
      },
    },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// Auto-sum before validation so `totalAmount` is always items' sum.
// (Rounded to 2 decimals to avoid floating-point dust like 670.5000000001.)
ExpenseSchema.pre("validate", function () {
  this.totalAmount =
    Math.round(this.items.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
});

// The monthly report scans by group + date range constantly
ExpenseSchema.index({ group: 1, date: 1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
